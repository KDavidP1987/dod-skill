#!/usr/bin/env node
// dod-feedback.mjs — opt-in public feedback from closed plans.
//
// A closed plan knows how well it predicted its own build. This script turns that into one public issue on the
// skill's own repository, and only ever with the user's consent, which lives in their own home directory and not
// in any repository. Off is the default: with no consent entry nothing is sent, nothing is asked and nothing is
// written. The destination is a constant — no flag, no environment variable and no file in a project can move it.
//
// Everything that reaches the issue is built here from numbers and enums; the only free text that can reach it is
// an amendment's `why`, and that passes the scrub (SCRUB_RULES) and then a second whole-body leak scan before a
// single byte leaves the machine. gh's own output is read for the issue URL and is never printed or recorded.
//
//   node dod-feedback.mjs --draft <slug>            print what would be sent, with its draft id
//   node dod-feedback.mjs --send <slug> [--yes] [--again] [--draft-id <id>]
//   node dod-feedback.mjs --sample                  what a report from this store would carry, before anyone consents
//   node dod-feedback.mjs --profile                 this store's consent, detail and asked date
//   node dod-feedback.mjs --set-consent off|review|auto [--detail numbers|reasons] [--private-reasons]
//   node dod-feedback.mjs --needs-question          exit 0 when this store has never been asked
//   node dod-feedback.mjs --selftest [--assert-timing] [--case <name>]
//
// Plan: docs/dod/feedback-loop.md (D1–D17); the reasons scrub, visibility and the send guard: docs/dod/feedback-privacy.md.

import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, readdirSync, chmodSync, realpathSync, statSync, openSync, writeSync, closeSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir, platform } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parsePlan, parseReviews, reportNumbers, resolveStore, scanForLeaks, writeAtomic, plainText, checkPlan } from "./dod-index.mjs";

const SELF = fileURLToPath(import.meta.url);

// ---------------------------------------------------------------- constants

export const REPO = "KDavidP1987/dod-skill";        // the one destination; built into every URL below
export const LABEL = "dod-feedback";
export const TARGET = 90;                            // the prediction rate a plan aims for
export const GH_TIMEOUT_MS = 30000;
export const MAX_REASONS = 20;
export const MAX_REASON = 200;
export const MAX_URL = 8000;
export const MAX_NEEDLE_SLUGS = 5000;
const GH_CAP = 64 * 1024;                            // gh output is read only for the issue URL, and capped
const RECORD_SHOWN = "~/.dod/feedback-consent.json"; // what the user sees; the real path holds their home folder
const CONSENTS = ["off", "review", "auto"];
const DETAILS = ["numbers", "reasons"];
const REVIEWERS = ["codex", "subagent", "human"];

export const USAGE =
  "usage: dod-feedback.mjs --draft <slug> | --send <slug> [--yes] [--again] [--draft-id <id>] | --sample | --profile | " +
  "--set-consent <c> [--detail <d>] [--private-reasons] | --needs-question | --selftest [--case <name>] [--dir <store>]";

export const issuesUrl = () => `https://github.com/${REPO}/issues`;
export const newIssueUrl = () => `${issuesUrl()}/new`;
// gh prints the created issue's URL on stdout; anything else it prints is ignored and never recorded
export const issueUrlRe = () => new RegExp(`https://github\\.com/${REPO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/issues/\\d+`);

// ---------------------------------------------------------------- the consent record (D10, D15)

// The record is per user, not per repository: a collaborator cannot consent for you and a clone carries nothing.
// The key is the store's real path so two paths to one store (a junction, a symlink, a different drive letter
// spelling) are one entry; Windows path case is not significant, so the key is lower-cased there.
export function storeKey(storeDir) {
  let p = storeDir;
  try { p = realpathSync(storeDir); } catch { /* a store that does not exist yet still gets a stable key */ }
  p = resolve(p).replace(/\\/g, "/");
  return platform() === "win32" ? p.toLowerCase() : p;
}

export const homeDir = (env = process.env) =>
  (platform() === "win32" ? env.USERPROFILE : env.HOME) || homedir();
export const recordPath = (home) => join(home, ".dod", "feedback-consent.json");

// Never echo a record value raw — it is a file, and a file can hold a terminal escape. plainText deletes control
// and format characters, which is safe but silent, so they are rendered as <U+XXXX> first (A1): the line stays
// printable ASCII and still says what was in the file.
const showEscapes = (v) => String(v).replace(/[^\x20-\x7e]/gu, (c) => `<U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}>`);
const quoted = (v) => plainText(showEscapes(v)).slice(0, 40);

// Reads one store's entry out of the record's text. Every failure has a default and a warning; none of them is an
// error, because a record that cannot be understood must mean off, not "send anyway".
export function readConsent(recordText, key) {
  const out = { consent: "off", detail: "numbers", asked: "never", warnings: [], json: true };
  if (recordText === null || recordText === undefined) return out;
  let data;
  try { data = JSON.parse(recordText); } catch {
    out.json = false;
    out.warnings.push("feedback: consent record is not valid JSON — treated as off; run --set-consent to rewrite it");
    return out;
  }
  const entry = data && typeof data === "object" && data.stores && typeof data.stores === "object" ? data.stores[key] : undefined;
  if (!entry || typeof entry !== "object") return out;
  if (entry.consent !== undefined) {
    if (CONSENTS.includes(entry.consent)) out.consent = entry.consent;
    else out.warnings.push(`feedback: consent "${quoted(entry.consent)}" is not off, review or auto — treated as off`);
  }
  if (entry.detail !== undefined) {
    if (DETAILS.includes(entry.detail)) out.detail = entry.detail;
    else out.warnings.push(`feedback: detail "${quoted(entry.detail)}" is not numbers or reasons — treated as numbers`);
  }
  if (entry.asked !== undefined) {
    if (typeof entry.asked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.asked)) out.asked = entry.asked;
    else out.warnings.push(`feedback: asked "${quoted(entry.asked)}" is not a date — treated as never`);
  }
  // feedback-privacy D6: reasons from a private repository only on the exact JSON boolean true; the property is set
  // only then, so a record without the choice reads exactly as it did before the field existed
  if (entry.private_reasons !== undefined) {
    if (entry.private_reasons === true) out.privateReasons = true;
    else if (entry.private_reasons !== false) out.warnings.push(`feedback: private_reasons "${quoted(entry.private_reasons)}" is not true or false — treated as not chosen`);
  }
  return out;
}

// ---------------------------------------------------------------- visibility (feedback-privacy D5, D6)

// Read at every draft, sample and send, never cached (4.3). Anything short of a clear answer from gh is "unknown",
// which counts as private. gh's output is read for one boolean and never printed or kept.
export const VISIBILITY_TIMEOUT_MS = 10000;
export function readVisibility(storeDir, { gh = "gh", git = "git", timeoutMs = VISIBILITY_TIMEOUT_MS } = {}) {
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: storeDir, encoding: "utf8", shell: false, timeout: timeoutMs, maxBuffer: GH_CAP, windowsHide: true });
  const r = run(git, ["remote"]);
  if (r.error) return { state: "unknown", cause: r.error.code === "ENOENT" ? "git is not installed" : "git could not be run" };
  if (r.status !== 0) return { state: "unknown", cause: "not a git repository" };
  if (!String(r.stdout).trim()) return { state: "unknown", cause: "no remote" };
  const [cmd, ...prefix] = Array.isArray(gh) ? gh : [gh];
  const v = run(cmd, [...prefix, "repo", "view", "--json", "isPrivate"]);
  if (v.error) {
    if (v.error.code === "ENOENT") return { state: "unknown", cause: "gh is not installed" };
    if (v.error.code === "ETIMEDOUT") return { state: "unknown", cause: `no answer from gh in ${Number((timeoutMs / 1000).toFixed(1))} s` };
    return { state: "unknown", cause: "gh could not be run" };
  }
  if (v.status !== 0) return { state: "unknown", cause: "gh could not read it — offline or not signed in" };
  let data = null;
  try { data = JSON.parse(v.stdout); } catch { /* below */ }
  if (data && data.isPrivate === true) return { state: "private" };
  if (data && data.isPrivate === false) return { state: "public" };
  return { state: "unknown", cause: "gh gave no answer it could read" };
}

// What a draft or send carries: reasons only when consented and the repository is public, or private with the user's
// own recorded choice. The why-line goes to the terminal and never into the body.
export function effectiveDetail(detail, { visibility, privateReasons = false, consent = "review" } = {}) {
  if (detail !== "reasons") return { detail: "numbers", why: null };
  if (visibility?.state === "public") return { detail: "reasons", why: null };
  if (visibility?.state === "private" && privateReasons === true) return { detail: "reasons", why: null };
  if (visibility?.state === "private") {
    return { detail: "numbers", why: `feedback: this repository is private — reasons left out, numbers only; to send reasons from it, run --set-consent ${consent} --detail reasons --private-reasons` };
  }
  return { detail: "numbers", why: `feedback: this repository's visibility could not be read (${visibility?.cause ?? "unknown"}) — treated as private: reasons left out, numbers only` };
}

// ---------------------------------------------------------------- the scrub (D6)

// Each rule is one named replacement, applied per line, in this order: the wider forms first so a URL is removed as
// a URL rather than half-eaten as a path. The list is exported so the selftest can disable one rule at a time and
// prove that each is the reason its case passes.
export const SCRUB_RULES = [
  // feedback-privacy D1: a code span goes whole — a run of backticks to the next run of the same length, then any
  // backtick left unmatched on its own — first, so nothing inside it is half-eaten by a later rule
  { name: "backticks", apply: (s) => s.replace(/(`+)[^]*?(?<!`)\1(?!`)/g, "[removed]").replace(/`/g, "") },
  { name: "urls", apply: (s) => s.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[removed]").replace(/\bwww\.\S+/gi, "[removed]") },
  { name: "emails", apply: (s) => s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[removed]") },
  { name: "windows-paths", apply: (s) => s.replace(/\\\\[^\s]+/g, "[removed]").replace(/\b[A-Za-z]:[\\/][^\s]*/g, "[removed]") },
  { name: "posix-paths", apply: (s) => s.replace(/~[\\/]\S*/g, "[removed]").replace(/(?<![\w.])\/(?:[^\s/]+\/)+[^\s/]*/g, "[removed]") },
  { name: "relative-paths", apply: (s) => s.replace(/(?<![\w.])\.\.?\/\S+/g, "[removed]").replace(/(?<![\w./])[\w.-]+\/[\w.\-/]+/g, "[removed]") },
  { name: "shas", apply: (s) => s.replace(/(?<![\w])[0-9a-f]{7,40}(?![\w])/g, "[removed]") },
  { name: "secrets", apply: (s) => s.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "[removed]").replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "[removed]").replace(/\bAKIA[0-9A-Z]{8,}/g, "[removed]") },
  // feedback-privacy D25: snake_case, camelCase and dotted names; an abbreviation of single letters (e.g., i.e.) stays
  { name: "identifiers", apply: (s) => s
    .replace(/\b[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+\b/g, "[removed]")
    .replace(/\b[a-z]+(?:[A-Z][a-z0-9]+)+\b/g, "[removed]")
    .replace(/(?<![\w.])[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+/g, (m) => (m.split(".").every((p) => p.length === 1) ? m : "[removed]")) },
  // feedback-privacy D2: tracker ids in any case — dod's own S-10 and UTF-16 included, on purpose (4.4)
  { name: "trackers", apply: (s) => s.replace(/\b[A-Za-z][A-Za-z0-9]*-\d+\b/g, "[removed]") },
  { name: "needles", apply: (s, needles) => { for (const n of needles) if (n && n.length >= 4) s = s.split(new RegExp(escapeRe(n), "gi")).join("[removed]"); return s; } },
  { name: "at-signs", apply: (s) => s.replace(/@/g, "(at)") }, // no GitHub user is ever mentioned by a report
];

// feedback-privacy D3, D24: a reason that is withheld keeps its probe and loses every word. The first rule that
// matches names the line. The list is exported so the selftest can disable one rule and watch the reason leak.
const SENSITIVE_WORDS = /\b(?:passwords?|secrets?|tokens?|credentials?|keys?|e-?mails?|personal\s+data|piis?|admins?|roles?|permissions?|ssns?)\b/i;
export const WITHHOLD_RULES = [
  { name: "security-layers", label: "permissions or security", test: (a) => /^(?:2|10)(?:\.\d{1,2})?$/.test(String(a.layer ?? "")) },
  { name: "sensitive-words", label: "sensitive word", test: (a) => SENSITIVE_WORDS.test(String(a.why ?? "")) },
];

const escapeRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function scrub(text, needles = [], rules = SCRUB_RULES) {
  return String(text)
    .split("\n")
    .map((line) => rules.reduce((s, r) => r.apply(s, needles), line))
    .join("\n");
}

// The words a report must never carry: this plan's slug and the long words of its title, every other plan's slug,
// and the two folder names that identify the machine and its owner.
export function scrubNeedles(plan, slugs, cwd, home) {
  const words = String(plan.fm.title ?? "").split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 4);
  return [...new Set([plan.slug, ...words, ...slugs, basename(cwd), repoFolderName(cwd), basename(home)].filter(Boolean))];
}

// feedback-privacy D10: the folder that names the project is the repository's top-level folder, not the folder a
// send runs from — run from the store (`dod`), that name is in every report's fixed text and refused every send.
// A name shorter than 4 characters, or one that is a word of the fixed text, can never be told from the report itself.
const FIXED_TEXT = "dod feedback prediction success below target not measured none version size kind feature rate result waiting on the owner counted " +
  "baseline items discovered design changes requested defect external missed probes review rounds reviewer pending other codex subagent human " +
  "coverage author layers why the plan missed withheld permissions or security sensitive word details omitted for a report and more unknown no layer";
const FIXED_WORDS = new Set(FIXED_TEXT.split(" "));
export function repoFolderName(cwd) {
  let d = resolve(cwd);
  for (;;) {
    if (existsSync(join(d, ".git"))) break;
    const up = dirname(d);
    if (up === d) { d = resolve(cwd); break; } // not in a repository: the folder it runs from
    d = up;
  }
  const name = basename(d);
  return name.length >= 4 && !FIXED_WORDS.has(name.toLowerCase()) ? name : null;
}

// The final check runs over the finished title and body: the scrub works on what it recognises, this works on what
// must not appear whatever form it took. Keys are what the refusal line names.
export function leakNeedles(slugs, cwd, home) {
  const needles = { "the working directory": cwd, "your home directory": home, "the repository folder name": repoFolderName(cwd) };
  for (const s of slugs) needles[`the slug ${s}`] = s;
  return needles;
}

// ---------------------------------------------------------------- the report (D4, D5)

const enumOr = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const coverageOr = (v) => (v === "pending" ? "pending" : /^\d+\/\d+ layers · \d+\/\d+ probes$/.test(String(v ?? "")) ? v : "unknown");

export function skillVersion(skillMd = join(dirname(SELF), "..", "SKILL.md")) {
  try {
    const m = readFileSync(skillMd, "utf8").match(/^\s*version:\s*"?([0-9][0-9A-Za-z.\-+]*)"?\s*$/m);
    return m ? m[1] : "unknown";
  } catch { return "unknown"; }
}

// The body is a fixed list of key: value lines — no free text unless the user asked for reasons, and none at all
// in a success report, which stops after `result`. Nothing here is taken from the plan except numbers and enums.
export function buildReport(plan, reviews, { version = "unknown", detail = "numbers", needles = [], reviewsUnreadable = false, numbers = null, scrubRules = SCRUB_RULES, withholdRules = WITHHOLD_RULES } = {}) {
  const n = numbers ?? reportNumbers(plan);
  // north-star A2: a partial close scores the verified items only; the items waiting on the owner are named by count
  const base = /* ns-mutant:feedback-scored */n.scored ?? n.baseline, disc = n.discoveredDesign;
  const measured = base + disc > 0;
  const rate = measured ? Math.round((base / (base + disc)) * 100) : null;
  const result = !measured ? "not measured" : rate >= TARGET ? "success" : "below target";
  const title = `dod feedback: ${measured ? `${rate} %` : "none"} prediction · ${enumOr(plan.fm.size, ["S", "M", "L", "Epic"], "unknown")} ${/^[a-z]{1,12}$/.test(plan.kind) ? plan.kind : "unknown"} · ${result}`;

  const probes = [...new Set(Object.keys(n.missed).filter((l) => /^\d{1,2}(\.\d{1,2})?$/.test(l)))]
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const rounds = reviewsUnreadable ? "unknown" : String(reviews.length);
  const reviewer = reviews.length ? enumOr(reviews.at(-1).reviewer, REVIEWERS, "other") : "pending";

  const head = [
    `dod version: ${version}`,
    `size: ${enumOr(plan.fm.size, ["S", "M", "L", "Epic"], "unknown")}`,
    `kind: ${/^[a-z]{1,12}$/.test(plan.kind) ? plan.kind : "unknown"}`,
    `prediction rate: ${base} / (${base} + ${disc}) = ${measured ? `${rate} %` : "none"}`,
    `target: ${TARGET} %`,
    `result: ${result}`,
    ...(n.partial ? [`waiting on the owner: ${n.waiting.length} (not counted)`] : []),
  ];
  if (result === "success") return { title, body: [...head, "details: omitted for a success report"].join("\n"), rate, result };

  const body = [
    ...head,
    `baseline items: ${base}`,
    `discovered design changes: ${disc}`,
    `requested: ${n.requested}`,
    `defect: ${n.defect}`,
    `external: ${n.external}`,
    // field-fixes D6: each missed probe carries how many design changes named it
    `missed probes: ${probes.length ? probes.map((p) => /* ffx-mutant:missed-counts */`${p} (${n.missed[p]})`).join(", ") : "none"}`,
    `review rounds: ${rounds}`,
    `reviewer: ${reviewer}`,
    `coverage author: ${coverageOr(plan.fm.coverage_author)}`,
    `coverage reviewer: ${coverageOr(plan.fm.coverage_reviewer)}`,
  ];
  if (detail === "reasons") {
    const discovered = plan.amendments.filter((a) => a.kind === "discovered");
    if (discovered.length) {
      body.push("", "## Why the plan missed");
      for (const a of discovered.slice(0, MAX_REASONS)) {
        const layer = /^\d{1,2}(\.\d{1,2})?$/.test(a.layer) ? a.layer : "no layer";
        const held = withholdRules.find((r) => r.test(a));
        if (held) { body.push(`- ${layer} · withheld (${held.label})`); continue; }
        // the scrub runs before the cut, so a span the cut would halve is still removed whole (D1)
        body.push(`- ${layer} · ${scrub(a.why, needles, scrubRules).replace(/\s+/g, " ").trim().slice(0, MAX_REASON)}`);
      }
      if (discovered.length > MAX_REASONS) body.push(`- … and ${discovered.length - MAX_REASONS} more`);
    }
  }
  return { title, body: body.join("\n"), rate, result };
}

// ---------------------------------------------------------------- draft id and the fallback URL (D2, D7)

export const draftId = (title, body) => createHash("sha256").update(`${title}\n${body}`).digest("hex").slice(0, 12);

// When gh cannot post it, the user can: one prefilled URL, kept under the length every browser and server accepts.
export function fallbackUrl(title, body) {
  const build = (b) => `${newIssueUrl()}?${new URLSearchParams({ title, body: b, labels: LABEL })}`;
  let url = build(body);
  if (url.length <= MAX_URL) return url;
  const cut = " … (cut)";
  let lo = 0, hi = body.length;
  while (lo < hi) { // longest body whose encoded URL still fits
    const mid = Math.ceil((lo + hi) / 2);
    if (build(body.slice(0, mid) + cut).length <= MAX_URL) lo = mid; else hi = mid - 1;
  }
  url = build(body.slice(0, lo) + cut);
  return url;
}

export const timeoutClass = (ms) => `gh timed out after ${Number((ms / 1000).toFixed(1))} s`;

// ---------------------------------------------------------------- reading the store

const readOr = (p, hooks) => (hooks.readFile ? hooks.readFile(p) : readFileSync(p, "utf8"));

export function storeSlugs(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "profile.md" && !f.endsWith(".reviews.md"))
      .map((f) => basename(f, ".md"));
  } catch { return []; }
}

// Above the cap the longest slugs are the ones worth checking: a short slug is far more often a common word
// contained in the text than a unique leak.
export function needleSlugs(slugs, own, warn) {
  if (slugs.length <= MAX_NEEDLE_SLUGS) return slugs;
  warn(`feedback: more than ${MAX_NEEDLE_SLUGS.toLocaleString("en-US")} plans — leak check uses the ${MAX_NEEDLE_SLUGS.toLocaleString("en-US")} longest slugs`);
  const kept = [...slugs].sort((a, b) => b.length - a.length).slice(0, MAX_NEEDLE_SLUGS);
  return kept.includes(own) ? kept : [own, ...kept];
}

const today = (now) => {
  const d = now ? now() : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// One place builds everything a draft or a send needs, so `--draft` and `--send` can never disagree about what
// would be posted — the draft id is the proof of that (D2).
function prepare(slug, { dir, home, hooks = {}, out }) {
  const store = resolveStore(dir);
  const file = join(store, `${slug}.md`);
  if (!existsSync(file)) return { error: `no plan ${slug} in ${store}`, code: 1 };
  let text;
  try { text = readOr(file, hooks); } catch (e) { return { error: `feedback: cannot read ${slug}.md (${e.code ?? "EIO"})`, code: 1 }; }
  const plan = parsePlan(text, file);
  if (plan.fm.status !== "done") return { error: `feedback: ${slug} is ${plan.fm.status ?? "unparsed"} — feedback is sent after close`, code: 1 };

  const reviewsFile = join(store, `${slug}.reviews.md`);
  let reviews = [], reviewsUnreadable = false;
  if (existsSync(reviewsFile)) {
    try { reviews = parseReviews(readOr(reviewsFile, hooks)); }
    catch (e) { reviewsUnreadable = true; out(`feedback: cannot read ${slug}.reviews.md (${e.code ?? "EIO"}) — review rounds reported as unknown`); }
  }

  const cwd = process.cwd(), home2 = home ?? homeDir();
  const slugs = needleSlugs(storeSlugs(store), slug, out);
  return { store, file, text, plan, reviews, reviewsUnreadable, slugs, cwd, home: home2 };
}

// ---------------------------------------------------------------- draft (D3)

export function draft(slug, opts = {}) {
  const lines = [];
  const out = (l) => lines.push(l);
  const p = prepare(slug, { ...opts, out });
  if (p.error) return { lines, error: p.error, code: p.code };
  // feedback-privacy D5: reasons only where the repository's visibility allows them; numbers need no read
  const asked = opts.detail ?? "numbers";
  const visibility = asked === "reasons" ? (opts.visibility ?? readVisibility(p.store, { gh: opts.gh, timeoutMs: opts.visibilityTimeoutMs })) : null;
  const { detail, why } = effectiveDetail(asked, { visibility, privateReasons: opts.privateReasons === true, consent: opts.consent });
  const report = buildReport(p.plan, p.reviews, {
    version: skillVersion(), detail, reviewsUnreadable: p.reviewsUnreadable,
    needles: scrubNeedles(p.plan, p.slugs, p.cwd, p.home),
  });
  // exactly: title, empty line, body, empty line, draft id — so the body is everything between the two empty lines;
  // a why-line (D5) comes after the id, outside the body
  out(report.title); out(""); out(report.body); out(""); out(`draft id: ${draftId(report.title, report.body)}`);
  if (why) out(why);
  return { lines, report, code: 0 };
}

// ---------------------------------------------------------------- sample (feedback-privacy D7)

// What a report from this store would carry, shown before the consent question: the numbers and the reasons draft of
// the newest closed plan whose report carries reasons lines — built by draft(), so it is exactly what a send would
// carry for this repository's visibility. Where that falls back to numbers, the reasons a send would carry if the
// user chose them follow under PREVIEW. It needs no consent, sends nothing and writes nothing.
export const PREVIEW = "preview only — this private repository sends numbers unless you choose reasons for it";
export const EXAMPLE = "example — not from your plans";
export function sample(opts = {}) {
  const lines = [];
  const out = (l) => lines.push(l);
  const store = resolveStore(opts.dir);
  const home = opts.home ?? homeDir();
  let text = null;
  if (existsSync(recordPath(home))) { try { text = readFileSync(recordPath(home), "utf8"); } catch { text = null; } }
  const c = readConsent(text, storeKey(store));
  const found = [];
  for (const slug of storeSlugs(store)) {
    let plan;
    try { plan = parsePlan(readFileSync(join(store, `${slug}.md`), "utf8"), join(store, `${slug}.md`)); } catch { continue; }
    if (plan.fm.status !== "done" || !plan.amendments.some((a) => a.kind === "discovered")) continue;
    if (buildReport(plan, []).result === "success") continue; // a success report stops before any reason (A1)
    found.push({ slug, closed: String(plan.fm.closed ?? "") });
  }
  found.sort((a, b) => b.closed.localeCompare(a.closed) || a.slug.localeCompare(b.slug));
  if (!found.length) {
    out(EXAMPLE);
    const ex = parsePlan(planText({ slug: "example", title: "an example", items: 6, extra: [7, 8, 9], amendments: [
      "- A1 · 2026-09-05 · discovered · +D7 · layer: 7.2 · two people editing the same record at once was not planned for",
      "- A2 · 2026-09-06 · discovered · +D8 · layer: 12.1 · the message a user sees when an upload fails was never designed",
      "- A3 · 2026-09-07 · discovered · +D9 · layer: 10.1 · an account of an access gap, which no report ever carries",
    ] }), "example.md");
    const r = buildReport(ex, [], { version: skillVersion(), detail: "reasons" });
    out(r.title); out(""); out(r.body);
    return { lines, code: 0 };
  }
  const slug = found[0].slug;
  const visibility = opts.visibility ?? readVisibility(store, { gh: opts.gh, timeoutMs: opts.visibilityTimeoutMs });
  const base = { dir: store, home, gh: opts.gh, visibility };
  const consent = c.consent === "off" ? "review" : c.consent;
  out(`sample — built from ${slug}, the newest closed plan whose report carries reasons; nothing is sent`);
  out(""); out("numbers:");
  for (const l of draft(slug, { ...base, detail: "numbers" }).lines) out(l);
  out(""); out("reasons:");
  const asked = draft(slug, { ...base, detail: "reasons", privateReasons: c.privateReasons === true, consent });
  for (const l of asked.lines) out(l);
  if (asked.report && !asked.report.body.includes("## Why the plan missed")) {
    out(""); out(PREVIEW);
    for (const l of draft(slug, { ...base, detail: "reasons", visibility: { state: "public" } }).lines) out(l);
  }
  return { lines, code: 0 };
}

// ---------------------------------------------------------------- send (D1, D2, D3, D7, D8, D16, D17)

function runGh(ghPath, args, body, timeoutMs) {
  // `gh` is normally the name of the real CLI; the selftest passes [node, fake-gh.mjs] so a fake can be started the
  // same way — one argument array, no shell, on either platform.
  const [cmd, ...prefix] = Array.isArray(ghPath) ? ghPath : [ghPath];
  return new Promise((done) => {
    let child;
    try { child = spawn(cmd, [...prefix, ...args], { shell: false, stdio: ["pipe", "pipe", "pipe"] }); }
    catch { return done({ ok: false, klass: "gh not installed" }); }
    let stdout = "", stderr = "", finished = false, timer = null;
    const finish = (r) => { if (finished) return; finished = true; if (timer) clearTimeout(timer); done(r); };
    child.on("error", (e) => finish({ ok: false, klass: e.code === "ENOENT" ? "gh not installed" : `gh exit ${e.code ?? "error"}` }));
    child.stdout.on("data", (b) => { if (stdout.length < GH_CAP) stdout += b.toString("utf8"); });
    child.stderr.on("data", (b) => { if (stderr.length < GH_CAP) stderr += b.toString("utf8"); });
    // gh's own output can carry account details: it is read for the issue URL and never printed, logged or kept
    child.stdin.on("error", () => { try { child.kill(); } catch { /* already gone */ } finish({ ok: false, klass: "gh stdin failed" }); });
    timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } finish({ ok: false, klass: timeoutClass(timeoutMs) }); }, timeoutMs);
    child.on("close", (code) => finish(code === 0 ? { ok: true, url: (stdout.match(issueUrlRe()) ?? [null])[0] } : { ok: false, klass: `gh exit ${code}` }));
    try { child.stdin.end(body); } catch { /* the error handler above reports it */ }
  });
}

export async function send(slug, opts = {}) {
  const lines = [];
  const out = (l) => lines.push(l);
  const { gh = "gh", timeoutMs = GH_TIMEOUT_MS, now, home, hooks = {}, dir, yes = false, again = false, draftIdGiven = null } = opts;
  const homeNow = home ?? homeDir();
  const record = recordPath(homeNow);

  const readRecord = () => {
    if (!existsSync(record)) return { text: null };
    try { return { text: readOr(record, hooks) }; }
    catch (e) { return { failed: e.code ?? "EIO" }; }
  };

  const first = readRecord();
  if (first.failed) { out(`feedback: cannot read the consent record (${first.failed}) — nothing sent`); return { lines, code: 1 }; }
  const consent = readConsent(first.text, storeKey(resolveStore(dir)));
  for (const w of consent.warnings) out(w);
  if (consent.consent === "off") { out("feedback: consent is off — nothing sent"); return { lines, code: 0 }; }

  const head = prepare(slug, { dir, home: homeNow, hooks, out: () => {} });
  if (head.error) { out(head.error); return { lines, code: head.code }; }

  // feedback-privacy D23: one send of a plan at a time. The plan is read again under the guard, so a send that
  // finished a moment ago is seen by its Log note below.
  const guard = takeGuard(opts.lockDir ?? tmpdir(), head.plan, slug, out);
  if (guard.refused) { out(guard.refused); return { lines, code: 1 }; }
  try {
    const p = prepare(slug, { dir, home: homeNow, hooks, out });
    if (p.error) { out(p.error); return { lines, code: p.code }; }

    // a plan that already carries a feedback note is not sent again by accident: one close, one report
    if (!again && p.plan.notes.some((n) => /^feedback (sent|link printed) · /.test(n.text))) {
      out(`feedback: ${slug} already has feedback — pass --again to send another`);
      return { lines, code: 1 };
    }

    // feedback-privacy D5, D6: the same visibility rule as --draft, so the approved draft id still matches here
    const visibility = consent.detail === "reasons" ? (opts.visibility ?? readVisibility(p.store, { gh, timeoutMs: opts.visibilityTimeoutMs })) : null;
    const { detail, why } = effectiveDetail(consent.detail, { visibility, privateReasons: consent.privateReasons === true, consent: consent.consent });
    if (why) out(why);
    let report = buildReport(p.plan, p.reviews, {
      version: skillVersion(), detail, reviewsUnreadable: p.reviewsUnreadable,
      needles: scrubNeedles(p.plan, p.slugs, p.cwd, p.home),
    });
    if (hooks.afterReport) report = hooks.afterReport(report); // selftest only: plant a needle the scrub cannot see
    const id = draftId(report.title, report.body);

    if (consent.consent === "review" && !yes) {
      out("feedback: review mode — show the user the draft (--draft) and send with --yes --draft-id <id> only after they agree");
      return { lines, code: 1 };
    }
    if (consent.consent === "review" && yes && !draftIdGiven) {
      out("feedback: review mode — show the user the draft (--draft) and send with --yes --draft-id <id> only after they agree");
      return { lines, code: 1 };
    }
    if (draftIdGiven && draftIdGiven !== id) {
      out("feedback: the report changed since the draft was shown — show the user the new draft");
      return { lines, code: 1 };
    }

    const leaked = scanForLeaks(`${report.title}\n${report.body}`, leakNeedles(p.slugs, p.cwd, p.home));
    if (leaked.length) { out(`feedback: the report still contains ${leaked.join(", ")} — not sent`); return { lines, code: 1 }; }

    // consent is read again here, as late as possible: an answer withdrawn while the report was built still counts
    if (hooks.beforeSpawn) hooks.beforeSpawn();
    const second = readRecord();
    if (second.failed) { out(`feedback: cannot read the consent record (${second.failed}) — nothing sent`); return { lines, code: 1 }; }
    const again2 = readConsent(second.text, storeKey(resolveStore(dir)));
    if (again2.consent !== consent.consent || !["review", "auto"].includes(again2.consent)) {
      out("feedback: consent changed during the send — nothing sent");
      return { lines, code: 1 };
    }

    out(`feedback: sending to ${REPO} with gh (up to ${Math.round(timeoutMs / 1000)} s)…`);
    const res = await runGh(gh, ["issue", "create", "--repo", REPO, "--title", report.title, "--label", LABEL, "--body-file", "-"], report.body, timeoutMs);

    let note, outcome, code = 0;
    if (res.ok && res.url) { out(`feedback: sent — ${res.url}`); note = `feedback sent · ${res.url}`; outcome = `sent as ${res.url}`; }
    else if (res.ok) {
      out(`feedback: gh reported success but printed no issue URL — check ${issuesUrl()}?q=label%3A${LABEL}`);
      note = "feedback sent · no URL returned"; outcome = "sent without a returned URL";
    } else {
      out(`feedback: could not send with gh (${res.klass}) — open this link to post it yourself:`);
      out(fallbackUrl(report.title, report.body));
      note = `feedback link printed · ${res.klass}`; outcome = "printed the link";
    }

    const line = `- ${today(now)} · note · ${note}`;
    const wrote = appendNote(p.file, line, hooks);
    if (!wrote.ok) {
      out(`feedback: ${outcome} but the Log note could not be written (${wrote.code}) — add this line to the Log by hand: ${line}`);
      code = 1;
    }
    return { lines, code, report };
  } finally { releaseGuard(guard); }
}

// The guard is one file per plan in the temporary folder, holding the sender's process id and start time. A guard
// whose process is gone, or older than GUARD_STALE_MS, is stale: removed, said in one line, and the send goes on.
export const GUARD_STALE_MS = 120000;
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
export const guardFile = (dir, plan, slug) => join(dir, `dod-feedback-send-${String(plan.fm.id ?? slug).replace(/[^A-Za-z0-9._-]/g, "_")}.lock`);
function takeGuard(dir, plan, slug, out) {
  const file = guardFile(dir, plan, slug);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, "wx");
      try { writeSync(fd, JSON.stringify({ pid: process.pid, started: new Date().toISOString() })); } finally { closeSync(fd); }
      return { file };
    } catch (e) {
      if (e.code !== "EEXIST") return { refused: `feedback: cannot write the send guard (${e.code ?? "EIO"}) — nothing sent` };
    }
    let held = null, mtime = Date.now();
    try { held = JSON.parse(readFileSync(file, "utf8")); } catch { /* being written, or damaged: judged by its age */ }
    try { mtime = statSync(file).mtimeMs; } catch { continue; } // gone since: try again
    const started = held && Date.parse(held.started);
    const age = Date.now() - (Number.isFinite(started) ? started : mtime);
    const alive = held ? Number.isInteger(held.pid) && pidAlive(held.pid) : true;
    if (alive && age <= GUARD_STALE_MS) return { refused: `feedback: another send of ${slug} is running — nothing sent` };
    out(`feedback: removed a stale send guard for ${slug} (${alive ? "older than 120 s" : "its process is gone"})`);
    try { rmSync(file, { force: true }); } catch { /* the next open says */ }
  }
  return { refused: `feedback: another send of ${slug} is running — nothing sent` };
}
function releaseGuard(guard) { if (guard?.file) { try { rmSync(guard.file, { force: true }); } catch { /* the next send finds it stale */ } } }

// One line, appended, with compare-before-rename: a plan edited between the read and the write is re-read and the
// note recomputed, up to three times. Nothing else in the plan changes.
function appendNote(file, line, hooks = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let text;
    try { text = readOr(file, hooks); } catch (e) { return { ok: false, code: e.code ?? "EIO" }; }
    const next = text.replace(/\n*$/, "\n") + `${line}\n`;
    try {
      if (hooks.writeNote) { if (hooks.writeNote(file, next) === false) continue; return { ok: true }; }
      if (writeAtomic(file, next, { expect: text })) return { ok: true };
    } catch (e) { return { ok: false, code: e.code ?? "EIO" }; }
  }
  return { ok: false, code: "EBUSY" };
}

// ---------------------------------------------------------------- consent commands (D10, D15, D16)

export function profile(opts = {}) {
  const home = opts.home ?? homeDir();
  const record = recordPath(home);
  const text = existsSync(record) ? (() => { try { return readOr(record, opts.hooks ?? {}); } catch { return null; } })() : null;
  const c = readConsent(text, storeKey(resolveStore(opts.dir)));
  const chosen = c.privateReasons === true ? " · reasons from a private repository: chosen" : "";
  return { lines: [...c.warnings, `feedback: consent ${c.consent} · detail ${c.detail} · asked ${c.asked}${chosen} · record ${RECORD_SHOWN}`], code: 0 };
}

export function needsQuestion(opts = {}) {
  const home = opts.home ?? homeDir();
  const record = recordPath(home);
  if (!existsSync(record)) return { lines: [], code: 0 };
  let data;
  try { data = JSON.parse(readOr(record, opts.hooks ?? {})); } catch { return { lines: [], code: 0 }; }
  const key = storeKey(resolveStore(opts.dir));
  const has = data && typeof data === "object" && data.stores && typeof data.stores === "object" && Object.prototype.hasOwnProperty.call(data.stores, key);
  return { lines: [], code: has ? 1 : 0 };
}

export function setConsent(value, opts = {}) {
  const lines = [];
  const out = (l) => lines.push(l);
  const { home = homeDir(), detail = null, now, dir, hooks = {}, privateReasons = false } = opts;
  const record = recordPath(home);
  const key = storeKey(resolveStore(dir));

  for (let attempt = 0; attempt < 3; attempt++) {
    let text = null;
    if (existsSync(record)) {
      try { text = readOr(record, hooks); }
      catch (e) { out(`feedback: cannot read the consent record (${e.code ?? "EIO"}) — nothing sent`); return { lines, code: 1 }; }
    }
    let data = { version: 1, stores: {} };
    if (text !== null) {
      try { data = JSON.parse(text); } catch {
        out(`feedback: consent record ${RECORD_SHOWN} is not valid JSON — fix or delete it, then run --set-consent again`);
        return { lines, code: 1 };
      }
      if (!data || typeof data !== "object") data = { version: 1, stores: {} };
      if (!data.stores || typeof data.stores !== "object") data.stores = {};
      data.version = 1;
    }
    const kept = data.stores[key] && DETAILS.includes(data.stores[key].detail) ? data.stores[key].detail : "numbers";
    // feedback-privacy D6: the choice is written only by --private-reasons, and every run without it clears it (8.2)
    data.stores[key] = { consent: value, detail: detail ?? kept, asked: today(now), ...(privateReasons === true ? { private_reasons: true } : {}) };
    const next = `${JSON.stringify(data, null, 2)}\n`;

    try { mkdirSync(dirname(record), { recursive: true, mode: 0o700 }); } catch { /* reported by the write below */ }
    if (hooks.beforeCompare) hooks.beforeCompare(record); // selftest only: another writer lands here
    let ok;
    try { ok = writeAtomic(record, next, { expect: text === null ? undefined : text }); }
    catch (e) { out(`feedback: cannot write the consent record (${e.code ?? "EIO"})`); return { lines, code: 1 }; }
    if (ok) {
      try { chmodSync(record, 0o600); } catch { /* not every filesystem has modes; the directory is the real guard */ }
      out(`feedback: consent ${value} · detail ${data.stores[key].detail} · asked ${data.stores[key].asked}${privateReasons === true ? " · reasons from a private repository: chosen" : ""} · record ${RECORD_SHOWN}`);
      return { lines, code: 0 };
    }
  }
  out("feedback: consent record changed underneath — run --set-consent again");
  return { lines, code: 1 };
}

// ---------------------------------------------------------------- CLI

// Exactly one mode, and every option must belong to it: a flag that does not fit is a usage error before anything
// is read, so a mistyped command can never send.
export function parseArgs(argv) {
  const modes = { "--draft": "draft", "--send": "send", "--sample": "sample", "--profile": "profile", "--set-consent": "set-consent", "--needs-question": "needs-question", "--selftest": "selftest" };
  const o = { mode: null, slug: null, value: null, dir: null, detail: null, draftId: null, yes: false, again: false, assertTiming: false, only: null, privateReasons: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (modes[a]) {
      if (o.mode) return { usage: true };
      o.mode = modes[a];
      if (a === "--draft" || a === "--send") { o.slug = argv[++i] ?? null; if (!o.slug || o.slug.startsWith("--")) return { usage: true }; }
      if (a === "--set-consent") { o.value = argv[++i] ?? null; if (!o.value || !CONSENTS.includes(o.value)) return { usage: true }; }
      continue;
    }
    if (seen.has(a)) return { usage: true };
    seen.add(a);
    if (a === "--dir") { o.dir = argv[++i] ?? null; if (!o.dir) return { usage: true }; continue; }
    if (a === "--detail") { o.detail = argv[++i] ?? null; if (!DETAILS.includes(o.detail)) return { usage: true }; continue; }
    if (a === "--draft-id") { o.draftId = argv[++i] ?? null; if (!o.draftId) return { usage: true }; continue; }
    if (a === "--yes") { o.yes = true; continue; }
    if (a === "--again") { o.again = true; continue; }
    if (a === "--assert-timing") { o.assertTiming = true; continue; }
    if (a === "--private-reasons") { o.privateReasons = true; continue; }
    if (a === "--case") { o.only = argv[++i] ?? null; if (!o.only || o.only.startsWith("--")) return { usage: true }; continue; }
    return { usage: true };
  }
  if (!o.mode) return { usage: true };
  if ((o.yes || o.again || o.draftId) && o.mode !== "send") return { usage: true };
  if ((o.detail || o.privateReasons) && o.mode !== "set-consent") return { usage: true };
  if ((o.assertTiming || o.only) && o.mode !== "selftest") return { usage: true };
  return o;
}

async function main(argv) {
  const o = parseArgs(argv);
  if (o.usage) { console.log(USAGE); process.exitCode = 1; return; }
  if (o.mode === "selftest") { process.exitCode = await selftest({ assertTiming: o.assertTiming, only: o.only }); return; }
  let r;
  if (o.mode === "draft") {
    const c = readConsentForStore(o.dir);
    r = draft(o.slug, { dir: o.dir, detail: c.detail, privateReasons: c.privateReasons === true, consent: c.consent });
    if (r.error) r.lines.push(r.error);
  } else if (o.mode === "send") r = await send(o.slug, { dir: o.dir, yes: o.yes, again: o.again, draftIdGiven: o.draftId });
  else if (o.mode === "sample") r = sample({ dir: o.dir });
  else if (o.mode === "profile") r = profile({ dir: o.dir });
  else if (o.mode === "needs-question") r = needsQuestion({ dir: o.dir });
  else r = setConsent(o.value, { dir: o.dir, detail: o.detail, privateReasons: o.privateReasons });
  for (const l of r.lines) console.log(l);
  process.exitCode = r.code;
}

function readConsentForStore(dir) {
  const record = recordPath(homeDir());
  let text = null;
  if (existsSync(record)) { try { text = readFileSync(record, "utf8"); } catch { text = null; } }
  return readConsent(text, storeKey(resolveStore(dir)));
}

// ---------------------------------------------------------------- selftest
//
// Every case runs in its own temp store with its own temp home, so the user's real consent record is never read or
// written, and with a fake gh, so the real one is never started — the no-real-gh case proves that by running the
// whole suite again behind a trap on PATH.

const LAYERS_15 = [
  ["Purpose & typical use", 3], ["Actors & permissions", 3], ["Inputs, outputs & data", 4],
  ["Business rules & invariants", 4], ["Internal interfaces", 3], ["External dependencies & contracts", 3],
  ["States & lifecycle", 3], ["Minimal stretch", 2], ["Maximal stretch", 3], ["Security & privacy", 4],
  ["Design & UX", 3], ["Failure handling & observability", 3], ["Performance & scale", 2],
  ["Rollout & compatibility", 3], ["Out of scope", 2],
];

// A plan the real checker accepts: a fixture must never prove something about a shape dod itself would reject.
export function planText({ slug = "widget", title = "the widget", status = "done", size = "M", items = 2, extra = [], amendments = [], notes = [], report = true } = {}) {
  const line = (i, word) => `- [x] D${i} · **Item ${i}** the plan ${word} thing ${i} · test: checker --selftest case ${i} (fails when: thing ${i} is absent)`;
  const base = [], cur = [];
  for (let i = 1; i <= items; i++) { base.push(line(i, "does")); cur.push(line(i, "does")); }
  for (const i of extra) cur.push(line(i, "also does"));
  const ev = cur.map((l) => `- 2026-09-10 · ${l.match(/D\d+/)[0]} · pass · test: checker --selftest, all pass · abc1234 · claude`);
  const rows = LAYERS_15.map(([name, n], k) => `| ${k + 1} | ${name} | Considered | ${n}/${n} | ${name} › D1 |`);
  const prose = LAYERS_15.map(([name]) => `## ${name}\nThe plan's answer for ${name.toLowerCase()}.`).join("\n\n");
  const log = [
    "- 2026-09-01 · status → draft · plan",
    "- 2026-09-02 · status → ready · approve · review: human",
    "- 2026-09-03 · status → in-progress · start",
    ...ev,
    ...(status === "done" ? ["- 2026-09-10 · status → done · close"] : []),
    ...notes.map((t) => `- 2026-09-11 · note · ${t}`),
  ];
  return `---
dod: 2
id: dod-20260901-w001
slug: ${slug}
title: ${title}
status: ${status}
size: ${size}
parent: none
kind: feature
created: 2026-09-01
baselined: 2026-09-02
closed: ${status === "done" ? "2026-09-10" : "none"}
commit: abc1234
coverage_author: 15/15 layers · 45/45 probes
coverage_reviewer: 15/15 layers · 45/45 probes
review: human
---

# DoD: ${title}

**Size:** ${size} — one file.

## Definition of Done
${cur.join("\n")}

${prose}

## Assumptions
- S-1 · validated · the thing exists · source: the repository

## Build plan
1. Build it · satisfies ${cur.map((l) => l.match(/D\d+/)[0]).join(", ")}

## Coverage
| # | Layer | Status | Probes | Pointer / reason |
|---|---|---|---|---|
${rows.join("\n")}

Gate — acceptance & testability: passed
${status === "done" && report ? "\n## Report\nPrediction rate 2 / (2 + 1) = 67 %\n" : ""}
## Baseline
${base.map((l) => l.replace("- [x] ", "- [ ] ")).join("\n")}

## Amendments
${amendments.join("\n")}

## Log
${log.join("\n")}
`;
}

const reviewsText = (rounds = 1) => Array.from({ length: rounds }, (_, i) =>
  `## Review ${i + 1} · 2026-09-02 · human · plan commit abc1234\n15/15 layers · 45/45 probes\nVERDICT: ${i + 1 === rounds ? "READY" : "REVISE"}\n`).join("\n");

// `gh repo view` (the visibility read, feedback-privacy D5) answers from GH_VIS_* and is not logged, so GH_LOG holds
// only the issues a case created; GH_DELAY holds an issue create open, for the racing sends of D23.
const FAKE_GH = `import { appendFileSync } from "node:fs";
if (process.argv[2] === "repo") {
  setTimeout(() => {
    process.stdout.write((process.env.GH_VIS_OUT ?? '{"isPrivate":false}') + "\\n");
    process.exit(Number(process.env.GH_VIS_EXIT || 0));
  }, Number(process.env.GH_VIS_DELAY || 0));
} else {
  let stdin = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => { stdin += d; });
  process.stdin.on("end", () => {
    appendFileSync(process.env.GH_LOG, JSON.stringify({ argv: process.argv.slice(2), stdin }) + "\\n");
    setTimeout(() => {
      if (process.env.GH_STDOUT) process.stdout.write(process.env.GH_STDOUT + "\\n");
      if (process.env.GH_STDERR) process.stderr.write(process.env.GH_STDERR + "\\n");
      process.exit(Number(process.env.GH_EXIT || 0));
    }, Number(process.env.GH_DELAY || 0));
  });
}
`;
const SLOW_GH = `setTimeout(() => process.exit(0), 5000);\n`;
const CLOSING_GH = `process.stdin.destroy();\nsetTimeout(() => process.exit(0), 3000);\n`;

// One case's world: a store with one plan, an empty home, and a fake gh that records what it was given. `git` makes
// the world a git repository — "remote" with an origin, "bare" without one — for the visibility read.
function world(root, planOpts = {}, { record, ghSource = FAKE_GH, env = {}, git = null } = {}) {
  const store = join(root, "docs", "dod");
  mkdirSync(store, { recursive: true });
  if (git) {
    spawnSync("git", ["init", "-q"], { cwd: root, shell: false });
    if (git === "remote") spawnSync("git", ["remote", "add", "origin", "https://github.com/example/example.git"], { cwd: root, shell: false });
  }
  const slug = planOpts.slug ?? "widget";
  writeFileSync(join(store, `${slug}.md`), planText(planOpts));
  writeFileSync(join(store, `${slug}.reviews.md`), reviewsText(planOpts.reviewRounds ?? 1));
  const home = join(root, "home");
  mkdirSync(join(home, ".dod"), { recursive: true });
  if (record !== undefined) writeFileSync(recordPath(home), typeof record === "string" ? record : JSON.stringify(record, null, 2));
  const ghFile = join(root, "fake-gh.mjs");
  writeFileSync(ghFile, ghSource);
  const ghLog = join(root, "gh.log");
  for (const [k, v] of Object.entries({ GH_LOG: ghLog, ...env })) process.env[k] = v;
  return {
    store, home, slug, gh: [process.execPath, ghFile],
    planFile: join(store, `${slug}.md`),
    calls: () => (existsSync(ghLog) ? readFileSync(ghLog, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []),
    entry: (consent, detail = "numbers") => ({ version: 1, stores: { [storeKey(store)]: { consent, detail, asked: "2026-09-01" } } }),
  };
}

const clearGhEnv = () => { for (const k of ["GH_LOG", "GH_STDOUT", "GH_STDERR", "GH_EXIT", "GH_DELAY", "GH_VIS_OUT", "GH_VIS_EXIT", "GH_VIS_DELAY"]) delete process.env[k]; };

// ---------------------------------------------------------------- feedback-privacy cases (0.3.4)
//
// Plan: docs/dod/feedback-privacy.md. Ten named cases, each runnable alone with `--selftest --case <name>`. Each
// plants the input that must not reach a report and, where one rule is the reason it passes, runs again with that
// rule disabled and expects the leak — a case that would pass without its rule fails instead. The expected strings
// are written here, never read from the code under test.

const FP_ISSUE = `https://github.com/${REPO}/issues/7`;
const FP_NOW = () => new Date(2026, 9, 6);
const FP_PRIVATE = { GH_VIS_OUT: '{"isPrivate":true}' };
const fpAmend = (rows) => rows.map(([layer, why], i) => `- A${i + 1} · 2026-09-05 · discovered · +D${i + 3} · layer: ${layer} · ${why}`);
const fpPlanOpts = (rows) => ({ items: 2, extra: rows.map((_, i) => i + 3), amendments: fpAmend(rows) });
const fpPlan = (rows) => parsePlan(planText(fpPlanOpts(rows)), "widget.md");
const fpReasons = (body) => { const i = body.indexOf("## Why the plan missed\n"); return i < 0 ? [] : body.slice(i).split("\n").slice(1).filter((l) => l.startsWith("- ")); };
const fpMissed = (body) => body.split("\n").find((l) => l.startsWith("missed probes: "));
const fpWithout = (list, name) => (list ?? []).filter((r) => r.name !== name);
// the body of a draft is everything between the title's empty line and the one before `draft id:`
const fpBody = (lines) => { const t = lines.join("\n"); const a = t.indexOf("\n\n"), b = t.indexOf("\n\ndraft id: "); return a < 0 || b < a ? null : t.slice(a + 2, b); };
const fpBlockAt = (hay, needle) => { for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((l, k) => hay[i + k] === l)) return i; return -1; };
const fpSnapshot = (root) => {
  const out = [];
  const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.name === ".git" || f.name === "gh.log") continue; if (f.isDirectory()) walk(p); else out.push([p, readFileSync(p, "utf8")]); } };
  walk(root);
  return JSON.stringify(out);
};
// one reasons body built straight from a plan; `rules` lets a case disable one scrub or withholding rule
const fpReport = (rows, opts = {}) => buildReport(fpPlan(rows), [], { version: "0.3.4", detail: "reasons", ...opts });

const FP_CASES = {
  // D1: every backticked span goes, before the 200-character cut, so a span the cut would halve still goes
  "fp-backticks": async () => {
    const rows = [
      ["4.5", "the `zqa_tbl.zqa_col` column was never covered by a check"],
      ["5.1", "a `zqbFn()` call was missing from the write path entirely"],
      ["7.2", "the `zqc policy` was wider than anyone had planned for"],
      ["7.3", "nested ``zqd`` spans and an unbalanced `zqe tail at the end"],
      ["9.1", `${"word ".repeat(38)}then \`zqf spans the two hundred character cut zqf\``],
    ];
    const bad = [];
    const text = fpReasons(fpReport(rows).body).join("\n");
    for (const t of ["zqa", "zqb", "zqc", "zqd", "zqf"]) if (text.includes(t)) bad.push(`${t} kept`);
    if (text.includes("`")) bad.push("a backtick kept");
    if (fpReasons(fpReport(rows).body).length !== rows.length) bad.push("a reason line lost");
    const off = fpReasons(fpReport(rows, { scrubRules: fpWithout(SCRUB_RULES, "backticks") }).body).join("\n");
    if (!off.includes("zqc")) bad.push("passes with the backtick rule disabled");
    return [bad.length === 0, bad.join("; ")];
  },
  // D25: bare identifiers go, backticks or not; abbreviations and hyphenated words stay
  "fp-identifiers": async () => {
    const rows = [
      ["4.5", "the customer_email field kept its old meaning after the move"],
      ["5.2", "getUserRole was never called on the write path at all"],
      ["3.4", "billing.invoices kept rows that nobody reads any more"],
      ["7.1", "plain words such as e.g. an x-ray view stayed exactly as written"],
    ];
    const bad = [];
    const text = fpReasons(fpReport(rows).body).join("\n");
    for (const t of ["customer_email", "getUserRole", "billing.invoices", "invoices"]) if (text.includes(t)) bad.push(`${t} kept`);
    for (const t of ["e.g.", "x-ray"]) if (!text.includes(t)) bad.push(`${t} removed`);
    const off = fpReasons(fpReport(rows, { scrubRules: fpWithout(SCRUB_RULES, "identifiers") }).body).join("\n");
    if (!off.includes("customer_email")) bad.push("passes with the identifier rule disabled");
    return [bad.length === 0, bad.join("; ")];
  },
  // D2: tracker-shaped ids go in any case; versions and probe numbers stay
  "fp-trackers": async () => {
    const rows = [
      ["4.5", "AB-123 was reopened twice before the release went out"],
      ["5.2", "PROJ2-45 held up the second package for several days"],
      ["7.2", "the fix in proj-12 came late, after v0.3.4 and probe 7.2"],
    ];
    const bad = [];
    const text = fpReasons(fpReport(rows).body).join("\n");
    for (const t of ["AB-123", "PROJ2-45", "proj-12"]) if (text.includes(t)) bad.push(`${t} kept`);
    if (!text.includes("v0.3.4")) bad.push("v0.3.4 removed");
    const off = fpReasons(fpReport(rows, { scrubRules: fpWithout(SCRUB_RULES, "trackers") }).body).join("\n");
    if (!off.includes("AB-123")) bad.push("passes with the tracker rule disabled");
    return [bad.length === 0, bad.join("; ")];
  },
  // D3: a layer-2 or layer-10 reason keeps its probe and loses every word; the missed-probes line is unchanged
  "fp-withheld": async () => {
    const rows = [
      ["10.1", "zqw1 anyone could write every column of the table"],
      ["2.2", "zqw2 members could bypass the gate entirely"],
      ["4.5", "zqw3 every set was narrower than the plan said"],
      ["10", "zqw4 nobody looked at the gate at all"],
    ];
    const bad = [];
    const r = fpReport(rows);
    const lines = fpReasons(r.body), text = lines.join("\n");
    for (const want of ["- 10.1 · withheld (permissions or security)", "- 2.2 · withheld (permissions or security)", "- 10 · withheld (permissions or security)"]) {
      if (!lines.includes(want)) bad.push(`no line "${want}"`);
    }
    for (const t of ["zqw1", "zqw2", "zqw4", "anyone", "bypass", "nobody"]) if (text.includes(t)) bad.push(`${t} kept`);
    if (!text.includes("zqw3")) bad.push("a 4.5 reason was withheld");
    const numbersBody = buildReport(fpPlan(rows), [], { version: "0.3.4", detail: "numbers" }).body;
    if (fpMissed(r.body) !== fpMissed(numbersBody) || !/2\.2 \(1\).*10\.1 \(1\)/.test(fpMissed(r.body) ?? "")) bad.push(`missed probes changed: ${fpMissed(r.body)}`);
    const off = fpReasons(fpReport(rows, { withholdRules: fpWithout(WITHHOLD_RULES, "security-layers") }).body).join("\n");
    if (!off.includes("zqw1")) bad.push("passes with withholding disabled");
    return [bad.length === 0, bad.join("; ")];
  },
  // D24: a reason holding a listed sensitive word is withheld at any layer; one without is kept
  "fp-sensitive": async () => {
    const rows = [
      ["3.3", "the customer SSN is retained forever"],
      ["4.1", "an admin role can approve its own change"],
      ["7.2", "two writers at once lost an entry in the store"],
    ];
    const bad = [];
    const r = fpReport(rows);
    const lines = fpReasons(r.body), text = lines.join("\n");
    for (const want of ["- 3.3 · withheld (sensitive word)", "- 4.1 · withheld (sensitive word)"]) if (!lines.includes(want)) bad.push(`no line "${want}"`);
    for (const t of ["customer", "retained", "forever", "approve", "SSN", "admin"]) if (text.includes(t)) bad.push(`${t} kept`);
    if (!text.includes("writers")) bad.push("a reason without a listed word was withheld");
    const numbersBody = buildReport(fpPlan(rows), [], { version: "0.3.4", detail: "numbers" }).body;
    if (fpMissed(r.body) !== fpMissed(numbersBody)) bad.push("missed probes changed");
    const off = fpReasons(fpReport(rows, { withholdRules: fpWithout(WITHHOLD_RULES, "sensitive-words") }).body).join("\n");
    if (!off.includes("retained")) bad.push("passes with the sensitive-word rule disabled");
    return [bad.length === 0, bad.join("; ")];
  },
  // D5: private, or visibility unreadable in any of five ways, drafts and sends the plain numbers body; the why-line
  // is printed to the terminal and never sent; public drafts reasons
  "fp-visibility": async ({ temp }) => {
    const rows = [["4.5", "the zqv1 reason that must stay out of private reports"]];
    const outcomes = [
      ["public", "remote", {}, true],
      ["private", "remote", FP_PRIVATE, false],
      ["no gh", "remote", {}, false, true],
      ["no remote", "bare", {}, false],
      ["not a git repository", null, {}, false],
      ["offline", "remote", { GH_VIS_EXIT: "1" }, false],
      ["no answer", "remote", { GH_VIS_DELAY: "4000" }, false],
    ];
    const bad = [];
    for (const [name, git, env, reasons, noGh] of outcomes) {
      clearGhEnv();
      const root = temp();
      const w = world(root, fpPlanOpts(rows), { record: undefined, git, env });
      const gh = noGh ? join(root, "no-such-gh-binary") : w.gh;
      const d = draft(w.slug, { dir: w.store, home: w.home, detail: "reasons", gh, visibilityTimeoutMs: 1500 });
      const body = fpBody(d.lines) ?? "";
      const after = d.lines.slice(d.lines.findIndex((l) => l.startsWith("draft id: ")) + 1);
      if (body.includes("## Why the plan missed") !== reasons) bad.push(`${name}: ${reasons ? "numbers" : "reasons"} body`);
      if (!reasons && !after.some((l) => l.startsWith("feedback: "))) bad.push(`${name}: no why-line`);
      if (body.includes("feedback: ")) bad.push(`${name}: the why-line is in the body`);
    }
    clearGhEnv();
    const root = temp();
    const w = world(root, fpPlanOpts(rows), { record: undefined, git: "remote", env: { ...FP_PRIVATE, GH_STDOUT: FP_ISSUE } });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto", "reasons")));
    const numbersBody = fpBody(draft(w.slug, { dir: w.store, home: w.home, detail: "numbers", gh: w.gh }).lines);
    const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: FP_NOW });
    if (w.calls().length !== 1 || w.calls()[0].stdin !== numbersBody) bad.push(`private send body is not the numbers body (${w.calls().length} calls)`);
    if (!r.lines.some((l) => l.startsWith("feedback: ") && /private/.test(l))) bad.push("private send printed no why-line");
    clearGhEnv();
    return [bad.length === 0, bad.join("; ")];
  },
  // D6: only the exact boolean, set by --set-consent --private-reasons, sends reasons from a private repository
  "fp-private-choice": async ({ temp }) => {
    const rows = [["4.5", "the zqp1 reason a private repository keeps to itself"]];
    const bad = [];
    const mk = (env, extra = {}, others = {}) => {
      clearGhEnv();
      const root = temp();
      const w = world(root, fpPlanOpts(rows), { record: undefined, git: "remote", env: { GH_STDOUT: FP_ISSUE, ...env } });
      const rec = w.entry("auto", "reasons");
      Object.assign(rec.stores[storeKey(w.store)], extra);
      Object.assign(rec.stores, others);
      writeFileSync(recordPath(w.home), JSON.stringify(rec, null, 2));
      return w;
    };
    const go = async (w) => {
      const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: FP_NOW });
      return { r, calls: w.calls().length, reasons: (w.calls()[0]?.stdin ?? "").includes("## Why the plan missed") };
    };
    let s = await go(mk(FP_PRIVATE));
    if (s.calls !== 1 || s.reasons) bad.push(`private without the choice: ${s.calls} calls, reasons ${s.reasons}`);
    for (const v of ["yes", 1, "true"]) {
      s = await go(mk(FP_PRIVATE, { private_reasons: v }));
      if (s.reasons) bad.push(`${JSON.stringify(v)} enabled reasons`);
      if (s.r.lines.filter((l) => l.includes("private_reasons")).length !== 1) bad.push(`${JSON.stringify(v)} printed no single warning`);
    }
    s = await go(mk(FP_PRIVATE, { private_reasons: false }));
    if (s.reasons || s.r.lines.some((l) => l.includes("private_reasons"))) bad.push("false enabled reasons or warned");
    s = await go(mk(FP_PRIVATE, { private_reasons: true }));
    if (!s.reasons) bad.push("private with the choice sent numbers");
    const unknown = mk({ GH_VIS_EXIT: "1" }, { private_reasons: true });
    s = await go(unknown);
    if (s.reasons) bad.push("unknown visibility with the choice sent reasons");
    if (!/private/.test(profile({ dir: unknown.store, home: unknown.home }).lines.at(-1))) bad.push("--profile omits the choice");
    // the record: written by the flag, cleared without it, and another store's entry untouched byte for byte
    const w = mk({}, {}, { "/somewhere/else": { consent: "review", detail: "reasons", asked: "2026-01-01", private_reasons: true } });
    const otherOf = () => JSON.stringify(JSON.parse(readFileSync(recordPath(w.home), "utf8")).stores["/somewhere/else"]);
    const before = otherOf();
    setConsent("review", { dir: w.store, home: w.home, detail: "reasons", privateReasons: true, now: FP_NOW });
    if (JSON.parse(readFileSync(recordPath(w.home), "utf8")).stores[storeKey(w.store)].private_reasons !== true) bad.push("--private-reasons not recorded as true");
    setConsent("review", { dir: w.store, home: w.home, detail: "reasons", now: FP_NOW });
    if ("private_reasons" in JSON.parse(readFileSync(recordPath(w.home), "utf8")).stores[storeKey(w.store)]) bad.push("--set-consent without the flag kept the choice");
    if (otherOf() !== before) bad.push("another store's entry changed");
    if (parseArgs(["--set-consent", "review", "--detail", "reasons", "--private-reasons"]).privateReasons !== true) bad.push("--private-reasons not parsed");
    if (parseArgs(["--draft", "a", "--private-reasons"]).usage !== true) bad.push("--private-reasons accepted outside --set-consent");
    clearGhEnv();
    return [bad.length === 0, bad.join("; ")];
  },
  // D7: --sample is the draft, exactly, for this repository's visibility; a private one adds the labelled preview;
  // nothing is written or sent and no consent is needed; an empty store prints the labelled example
  "fp-sample": async ({ temp }) => {
    const rows = [["4.5", "the zqs1 reason a user sees before they answer"]];
    const bad = [];
    const PREVIEW = "preview only — this private repository sends numbers unless you choose reasons for it";
    for (const [name, env] of [["public", {}], ["private", FP_PRIVATE]]) {
      clearGhEnv();
      const root = temp();
      const w = world(root, fpPlanOpts(rows), { record: undefined, git: "remote", env });
      // A1: a newer closed plan with a discovered amendment that is still a success report carries no reasons
      writeFileSync(join(w.store, "shipped.md"), planText({ slug: "shipped", items: 20, extra: [21], amendments: ["- A1 · 2026-09-05 · discovered · +D21 · layer: 7.2 · one late item"] }).replace("closed: 2026-09-10", "closed: 2026-09-12"));
      const before = fpSnapshot(root);
      const s = sample({ dir: w.store, home: w.home, gh: w.gh });
      const lines = s.lines ?? [];
      const dn = draft(w.slug, { dir: w.store, home: w.home, detail: "numbers", gh: w.gh }).lines;
      const dr = draft(w.slug, { dir: w.store, home: w.home, detail: "reasons", gh: w.gh }).lines;
      if (fpBlockAt(lines, dn) < 0) bad.push(`${name}: the numbers sample differs from --draft`);
      if (fpBlockAt(lines, dr) < 0) bad.push(`${name}: the reasons sample differs from --draft`);
      if (fpBlockAt(lines, draft("shipped", { dir: w.store, home: w.home, detail: "numbers", gh: w.gh }).lines) >= 0) bad.push(`${name}: the newer success plan was shown`);
      const at = lines.indexOf(PREVIEW);
      if (name === "public" && at >= 0) bad.push("public: a preview was printed");
      if (name === "private") {
        const chosen = draft(w.slug, { dir: w.store, home: w.home, detail: "reasons", privateReasons: true, gh: w.gh }).lines;
        if (at < 0) bad.push("private: no labelled preview");
        else if (fpBlockAt(lines.slice(at + 1), chosen) !== 0) bad.push("private: the preview differs from the draft with the choice recorded");
        if (at >= 0 && at < fpBlockAt(lines, dn)) bad.push("private: the preview comes before the numbers draft");
      }
      if (fpSnapshot(root) !== before) bad.push(`${name}: a file was written`);
      if (w.calls().length) bad.push(`${name}: gh issue was called`);
    }
    clearGhEnv();
    const root = temp();
    const store = join(root, "docs", "dod");
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, "open.md"), planText({ slug: "open", status: "in-progress" }));
    const e = sample({ dir: store, home: join(root, "home"), gh: [process.execPath, join(root, "no-such-gh.mjs")] });
    if ((e.lines ?? [])[0] !== "example — not from your plans") bad.push(`empty store: ${JSON.stringify((e.lines ?? [])[0])}`);
    return [bad.length === 0, bad.join("; ")];
  },
  // D10: a send from inside the store folder (`dod`) is not refused; the repository's own folder name still is
  "fp-store-folder": async ({ temp }) => {
    clearGhEnv();
    const bad = [];
    const repo = join(temp(), "acme-portal");
    mkdirSync(join(repo, ".git"), { recursive: true });
    const w = world(repo, fpPlanOpts([["4.5", "the acme-portal screens were never listed in the plan"]]), { record: undefined, env: { GH_STDOUT: FP_ISSUE } });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const cwd0 = process.cwd();
    try {
      process.chdir(w.store);
      const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: FP_NOW });
      if (r.code !== 0 || w.calls().length !== 1) bad.push(`refused from the store folder: ${r.lines.at(-1)}`);
      const d = draft(w.slug, { dir: w.store, home: w.home, detail: "reasons", visibility: { state: "public" } });
      if (d.lines.join("\n").includes("acme-portal")) bad.push("the reasons draft names the repository folder");
      const planted = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, again: true, now: FP_NOW, hooks: { afterReport: (rep) => ({ ...rep, body: `${rep.body}\nacme-portal` }) } });
      if (planted.code !== 1 || !String(planted.lines.at(-1)).includes("the repository folder name") || w.calls().length !== 1) bad.push(`a body naming acme-portal was not refused: ${planted.lines.at(-1)}`);
    } finally { process.chdir(cwd0); }
    clearGhEnv();
    return [bad.length === 0, bad.join("; ")];
  },
  // D23: two sends started together post one issue; a guard whose process is gone, or older than 120 s, is stale
  "fp-race": async ({ temp }) => {
    clearGhEnv();
    const bad = [];
    const root = temp();
    const w = world(root, {}, { record: undefined, env: { GH_STDOUT: FP_ISSUE, GH_DELAY: "2000" } });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const guards = () => readdirSync(root).filter((f) => f.startsWith("dod-feedback-send-"));
    const opts = { dir: w.store, home: w.home, gh: w.gh, now: FP_NOW, lockDir: root };
    const both = await Promise.all([send(w.slug, opts), send(w.slug, opts)]);
    if (w.calls().length !== 1) bad.push(`${w.calls().length} gh issue create calls`);
    if (!both.some((r) => r.code === 1 && r.lines.at(-1) === `feedback: another send of ${w.slug} is running — nothing sent`)) bad.push(`no refusal line: ${JSON.stringify(both.map((r) => r.lines.at(-1)))}`);
    if (guards().length) bad.push("a guard file remains after a finished send");
    process.env.GH_DELAY = "0";
    const guard = join(root, "dod-feedback-send-dod-20260901-w001.lock");
    const gone = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
    writeFileSync(guard, JSON.stringify({ pid: Number(gone.stdout), started: new Date().toISOString() }));
    const killed = await send(w.slug, { ...opts, again: true });
    if (killed.code !== 0 || w.calls().length !== 2 || !killed.lines.some((l) => /stale/.test(l))) bad.push(`a dead sender's guard kept the send refused: ${killed.lines.at(-1)}`);
    writeFileSync(guard, JSON.stringify({ pid: process.pid, started: new Date(Date.now() - 121000).toISOString() }));
    const old = await send(w.slug, { ...opts, again: true });
    if (old.code !== 0 || w.calls().length !== 3) bad.push(`a guard older than 120 s kept the send refused: ${old.lines.at(-1)}`);
    if (guards().length) bad.push("a guard file remains after the stale sends");
    clearGhEnv();
    return [bad.length === 0, bad.join("; ")];
  },
};

async function runFpCase(name, ctx) {
  try { return await FP_CASES[name](ctx); }
  catch (e) { return [false, `threw ${e?.name ?? "Error"}: ${String(e?.message ?? e).slice(0, 160)}`]; }
}

export async function selftest({ assertTiming = false, only = null } = {}) {
  let pass = 0;
  const failures = [];
  const expect = (name, cond, detail = "") => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ""}`); };
  const roots = [];
  const temp = () => { const r = mkdtempSync(join(tmpdir(), "dod-fb-")); roots.push(r); return r; };
  const ISSUE = `https://github.com/${REPO}/issues/7`;
  const finish = () => {
    clearGhEnv();
    for (const r of roots) { try { rmSync(r, { recursive: true, force: true }); } catch { /* a temp dir the OS still holds open is swept by the OS */ } }
    for (const f of failures) console.log(`  ✗ ${f}`);
    console.log(`selftest dod-feedback: ${pass}/${pass + failures.length} cases (${failures.length ? `${failures.length} failing` : "all pass"})`);
    return failures.length ? 1 : 0;
  };

  // one named case alone (feedback-privacy): the plan's evidence commands run exactly the case they cite
  if (only) {
    if (!Object.prototype.hasOwnProperty.call(FP_CASES, only)) { console.log(`selftest dod-feedback: no case "${only}"`); return 1; }
    const [ok, detail] = await runFpCase(only, { temp });
    expect(only, ok, detail);
    return finish();
  }

  // ---- D1: off means nothing sent
  {
    const cases = [
      ["consent-off", { record: undefined }, 0],                                        // no record file at all
      ["consent-absent", { record: { version: 1, stores: {} } }, 0],                    // a record without this store
      ["consent-invalid", { record: null }, 0],                                         // filled in below
      ["consent-bad-json", { record: "{not json" }, 0],
    ];
    for (const [name, opts] of cases) {
      const root = temp();
      const w = world(root, {}, { record: opts.record === null ? undefined : opts.record });
      if (name === "consent-invalid") writeFileSync(recordPath(join(root, "home")), JSON.stringify({ version: 1, stores: { [storeKey(join(root, "docs", "dod"))]: { consent: "yes please" } } }));
      const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20) });
      expect(name, r.code === 0 && r.lines.at(-1) === "feedback: consent is off — nothing sent" && w.calls().length === 0, JSON.stringify(r.lines));
      if (name === "consent-invalid") expect("consent-invalid warns", r.lines[0] === 'feedback: consent "yes please" is not off, review or auto — treated as off', JSON.stringify(r.lines[0]));
      if (name === "consent-bad-json") expect("consent-bad-json warns", r.lines[0] === "feedback: consent record is not valid JSON — treated as off; run --set-consent to rewrite it", JSON.stringify(r.lines[0]));
      clearGhEnv();
    }
    // a `## Feedback` section in profile.md is from an unreleased draft and is not consent
    const root = temp();
    const w = world(root, {});
    writeFileSync(join(w.store, "profile.md"), "## Feedback\n- consent · auto\n- detail · reasons\n");
    const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh });
    expect("consent-in-profile-ignored", r.code === 0 && r.lines.at(-1) === "feedback: consent is off — nothing sent" && w.calls().length === 0, JSON.stringify(r.lines));
    clearGhEnv();
  }

  // ---- D2: review mode waits for an explicit yes and for the id the user saw
  {
    const root = temp();
    const w = world(root, { amendments: ["- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · two at once was not planned"], extra: [3] }, { record: undefined });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("review")));
    const bare = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh });
    expect("consent-review waits", bare.code === 1 && bare.lines.at(-1) === "feedback: review mode — show the user the draft (--draft) and send with --yes --draft-id <id> only after they agree" && w.calls().length === 0, JSON.stringify(bare.lines));
    const noId = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, yes: true });
    expect("consent-review needs an id", noId.code === 1 && w.calls().length === 0, JSON.stringify(noId.lines));
    const d = draft(w.slug, { dir: w.store, home: w.home, detail: "numbers" });
    const id = d.lines.at(-1).replace("draft id: ", "");
    process.env.GH_STDOUT = ISSUE;
    const sent = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, yes: true, draftIdGiven: id, now: () => new Date(2026, 8, 20) });
    expect("consent-review sends with the id", sent.code === 0 && w.calls().length === 1, JSON.stringify(sent.lines));
    // the report changes underneath: the approved id no longer matches, so nothing is posted
    const w2root = temp();
    const w2 = world(w2root, {}, { record: undefined });
    writeFileSync(recordPath(w2.home), JSON.stringify(w2.entry("review")));
    const d2 = draft(w2.slug, { dir: w2.store, home: w2.home });
    const id2 = d2.lines.at(-1).replace("draft id: ", "");
    writeFileSync(w2.planFile, readFileSync(w2.planFile, "utf8").replace("## Amendments\n", "## Amendments\n- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · found late\n").replace(/^- \[x\] D2 (.*)$/m, "- [x] D2 $1\n- [x] D3 · **Item 3** the plan also does thing 3 · test: checker --selftest case 3 (fails when: thing 3 is absent)"));
    const stale = await send(w2.slug, { dir: w2.store, home: w2.home, gh: w2.gh, yes: true, draftIdGiven: id2 });
    expect("consent-review refuses a stale id", stale.code === 1 && stale.lines.at(-1) === "feedback: the report changed since the draft was shown — show the user the new draft" && w2.calls().length === 0, JSON.stringify(stale.lines));
    // and when only the body changed — an amendment reworded, the rate and so the title identical — the id must
    // still differ, or a user could approve one report and post another
    const w3root = temp();
    // a public repository (git with a remote, the fake gh's default answer), so the reasons are drafted (0.3.4 D5)
    const w3 = world(w3root, { items: 2, extra: [3], amendments: ["- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · the first wording"] }, { record: undefined, git: "remote" });
    writeFileSync(recordPath(w3.home), JSON.stringify(w3.entry("review", "reasons")));
    const d3 = draft(w3.slug, { dir: w3.store, home: w3.home, detail: "reasons", gh: w3.gh });
    const id3 = d3.lines.at(-1).replace("draft id: ", "");
    writeFileSync(w3.planFile, readFileSync(w3.planFile, "utf8").replace("the first wording", "a different wording entirely"));
    const d3b = draft(w3.slug, { dir: w3.store, home: w3.home, detail: "reasons", gh: w3.gh });
    expect("draft id covers the body", d3b.lines[0] === d3.lines[0] && d3b.lines.at(-1) !== d3.lines.at(-1), `${d3.lines[0]} | ${d3b.lines.at(-1)}`);
    const reworded = await send(w3.slug, { dir: w3.store, home: w3.home, gh: w3.gh, yes: true, draftIdGiven: id3 });
    expect("consent-review refuses a reworded body", reworded.code === 1 && reworded.lines.at(-1) === "feedback: the report changed since the draft was shown — show the user the new draft" && w3.calls().length === 0, JSON.stringify(reworded.lines));
    clearGhEnv();
  }

  // ---- D3: auto sends exactly one issue, with exactly these arguments and the draft's own body
  {
    const root = temp();
    const w = world(root, { amendments: ["- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · two at once was not planned"], extra: [3] }, { record: undefined });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    process.env.GH_STDOUT = `Creating issue in ${REPO}\n${ISSUE}`;
    const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20) });
    const calls = w.calls();
    const d = draft(w.slug, { dir: w.store, home: w.home });
    const text = d.lines.join("\n");
    const bodyFromDraft = text.slice(text.indexOf("\n\n") + 2, text.lastIndexOf("\n\n"));
    expect("consent-auto one call", calls.length === 1, JSON.stringify(calls.map((c) => c.argv)));
    expect("consent-auto argv", JSON.stringify(calls[0]?.argv) === JSON.stringify(["issue", "create", "--repo", REPO, "--title", d.lines[0], "--label", LABEL, "--body-file", "-"]), JSON.stringify(calls[0]?.argv));
    expect("consent-auto body is the draft's body", calls[0]?.stdin === bodyFromDraft, JSON.stringify(calls[0]?.stdin?.slice(0, 80)));
    expect("consent-auto announces the send", r.lines[0] === `feedback: sending to ${REPO} with gh (up to 30 s)…`, JSON.stringify(r.lines[0]));
    expect("consent-auto reports the URL", r.code === 0 && r.lines.includes(`feedback: sent — ${ISSUE}`), JSON.stringify(r.lines));
    const src = readFileSync(SELF, "utf8");
    expect("consent-auto no shell", !src.includes("shell:" + " true"), "the source names a shell spawn");
    expect("consent-auto one destination", src.split(REPO).length - 1 === 1, `${src.split(REPO).length - 1} occurrences`);
    clearGhEnv();
  }

  // ---- D4: the body is a fixed list of fields, and a success report stops early
  {
    const mk = (opts) => { const p = parsePlan(planText(opts), "widget.md"); return { p, reviews: parseReviews(reviewsText(opts.reviewRounds ?? 1)) }; };
    const short = mk({ items: 2 });
    const rs = buildReport(short.p, short.reviews, { version: "0.2.0" });
    expect("success-short", rs.body === [
      "dod version: 0.2.0", "size: M", "kind: feature", "prediction rate: 2 / (2 + 0) = 100 %", "target: 90 %", "result: success",
      "details: omitted for a success report",
    ].join("\n"), JSON.stringify(rs.body));
    expect("success-short title", rs.title === "dod feedback: 100 % prediction · M feature · success", rs.title);

    const low = mk({ items: 2, extra: [3, 4], amendments: ["- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · one", "- A2 · 2026-09-06 · discovered · +D4 · layer: 12.1 · two"] });
    const rl = buildReport(low.p, low.reviews, { version: "0.2.0" });
    expect("below-full", rl.body === [
      "dod version: 0.2.0", "size: M", "kind: feature", "prediction rate: 2 / (2 + 2) = 50 %", "target: 90 %", "result: below target",
      "baseline items: 2", "discovered design changes: 2", "requested: 0", "defect: 0", "external: 0",
      "missed probes: 7.2 (1), 12.1 (1)", "review rounds: 1", "reviewer: human",
      "coverage author: 15/15 layers · 45/45 probes", "coverage reviewer: 15/15 layers · 45/45 probes",
    ].join("\n"), JSON.stringify(rl.body));

    const none = mk({ items: 2 });
    const rn = buildReport(none.p, [], { version: "0.2.0" });
    expect("no-reviews", rn.body.includes("details: omitted") && buildReport(low.p, [], { version: "0.2.0" }).body.includes("review rounds: 0\nreviewer: pending"), JSON.stringify(rn.body));

    const zero = parsePlan(planText({ items: 0, report: false }), "empty.md");
    const rz = buildReport(zero, [], { version: "0.2.0" });
    expect("zero-rate", rz.body.includes("prediction rate: 0 / (0 + 0) = none") && rz.body.includes("result: not measured") && rz.title === "dod feedback: none prediction · M feature · not measured", `${rz.title} | ${rz.body.slice(0, 120)}`);

    // ffx.missed-counts (field-fixes D6): each missed probe with its count, sorted by probe; none counts nothing
    const three = mk({ items: 2, extra: [3, 4, 5], amendments: ["- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · one", "- A2 · 2026-09-06 · discovered · +D4 · layer: 7.2 · two", "- A3 · 2026-09-07 · discovered · +D5 · layer: 3.1 · three"] });
    const mline = (body) => body.split("\n").find((l) => l.startsWith("missed probes: "));
    expect("ffx.missed-counts", mline(buildReport(three.p, three.reviews, { version: "0.2.0" }).body) === "missed probes: 3.1 (1), 7.2 (2)" && mline(rz.body) === "missed probes: none",
      JSON.stringify([mline(buildReport(three.p, three.reviews, { version: "0.2.0" }).body), mline(rz.body)]));
  }

  // ---- north-star A2: a partial close reports the rate over the scored items and how many wait on the owner
  {
    const p = parsePlan(planText({ items: 4 }), "widget.md");
    const n = { ...reportNumbers(p), baseline: 4, scored: 3, partial: true, waiting: ["D4"], discoveredDesign: 1 };
    const r = buildReport(p, [], { version: "test", numbers: n });
    expect("ns-feedback-partial", r.body.includes("prediction rate: 3 / (3 + 1) = 75 %") && r.body.includes("waiting on the owner: 1 (not counted)") && r.rate === 75, JSON.stringify(r.body));
    const whole = buildReport(p, [], { version: "test" });
    expect("ns-feedback-whole", !whole.body.includes("waiting on the owner"), JSON.stringify(whole.body));
  }

  // ---- D5: reasons are opt-in, capped and scrubbed; numbers never carry free text
  {
    const many = Array.from({ length: 25 }, (_, i) => `- A${i + 1} · 2026-09-05 · discovered · +D${i + 3} · layer: 7.2 · reason ${i + 1} ${"y".repeat(500)}`);
    const p = parsePlan(planText({ items: 2, extra: Array.from({ length: 25 }, (_, i) => i + 3), amendments: many }), "widget.md");
    const r = buildReport(p, [], { version: "0.2.0", detail: "reasons" });
    const lines = r.body.split("\n").filter((l) => l.startsWith("- "));
    expect("reasons caps the list", lines.length === MAX_REASONS + 1 && lines.at(-1) === `- … and 5 more`, `${lines.length} lines`);
    expect("reasons cuts each line", lines.slice(0, MAX_REASONS).every((l) => l.length <= MAX_REASON + 8), JSON.stringify(lines[0].length));
    expect("reasons heading", r.body.includes("\n## Why the plan missed\n"), "no heading");
    const marker = "zzmarkerzz";
    const p2 = parsePlan(planText({ items: 2, extra: [3], amendments: [`- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · ${marker} happened`] }), "widget.md");
    expect("numbers-only", !buildReport(p2, [], { version: "0.2.0", detail: "numbers" }).body.includes(marker), "the marker reached a numbers-only body");
    expect("reasons carries the reason", buildReport(p2, [], { version: "0.2.0", detail: "reasons" }).body.includes(marker), "the reason did not reach a reasons body");
    const success = parsePlan(planText({ items: 2 }), "widget.md");
    expect("success never carries reasons", !buildReport(success, [], { version: "0.2.0", detail: "reasons" }).body.includes("Why the plan missed"), "a success report carried reasons");
  }

  // ---- D6: the scrub, rule by rule, and the refusal that catches whatever it missed
  {
    const needles = ["widget", "skillera-skills", "kdpen"];
    const planted = [
      "C:\\Users\\kdpen\\secret\\file.txt", "\\\\server\\share\\x", "/home/kdpen/x/y", "~/x/y", "../up/there", "src/x.ts",
      "https://example.com/a", "www.example.com/a", "someone@example.com", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      "sk-abcdefgh12345678", "AKIAABCDEFGH1234", "@maintainer", "widget", "skillera-skills",
      "`spanword`", "zz_snake", "zz.dotted.name", "ZZ-42", // feedback-privacy: backticks, identifiers, trackers
    ];
    const line = planted.join(" ");
    const out = scrub(line, needles);
    for (const p of planted) expect(`leak-scan removes ${p.slice(0, 18)}`, !out.includes(p), out.slice(0, 200));
    expect("leak-scan hides the at sign", !out.includes("@"), out);
    // each rule is the reason its own needle disappears: disable one, and something survives
    let caughtAll = true;
    for (const rule of SCRUB_RULES) {
      const without = SCRUB_RULES.filter((r) => r !== rule);
      const partial = scrub(line, needles, without);
      if (partial === out) { caughtAll = false; failures.push(`scrub rule ${rule.name} changes nothing — the case would pass without it`); }
    }
    expect("leak-scan every rule earns its place", caughtAll, "");
    // and the final scan is the backstop: a needle planted after the scrub is refused, with no call
    const root = temp();
    const w = world(root, {}, { record: undefined });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const r = await send(w.slug, {
      dir: w.store, home: w.home, gh: w.gh,
      hooks: { afterReport: (rep) => ({ ...rep, body: `${rep.body}\nleft behind: ${process.cwd()}` }) },
    });
    expect("leak-refusal", r.code === 1 && r.lines.at(-1) === "feedback: the report still contains the working directory — not sent" && w.calls().length === 0, JSON.stringify(r.lines));
    clearGhEnv();
  }

  // ---- D7: one attempt, one line, one link — and never a word of gh's own output
  {
    const secret = "ghp_" + "THISLOOKSLIKEATOKEN0123456789"; // split so the shipped source carries no token-shaped text
    const cases = [
      ["gh-missing", { ghSource: FAKE_GH }, "gh not installed"],
      ["gh-fails", { env: { GH_EXIT: "1" } }, "gh exit 1"],
      ["gh-timeout", { ghSource: SLOW_GH }, timeoutClass(200)],
      ["gh-stderr-hidden", { env: { GH_EXIT: "1", GH_STDERR: secret } }, "gh exit 1"],
    ];
    for (const [name, opts, klass] of cases) {
      const root = temp();
      const w = world(root, {}, { record: undefined, ...opts });
      writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
      const gh = name === "gh-missing" ? join(root, "no-such-gh-binary") : w.gh;
      const r = await send(w.slug, { dir: w.store, home: w.home, gh, timeoutMs: 200, now: () => new Date(2026, 8, 20) });
      const link = r.lines.at(-1);
      expect(`${name} line`, r.code === 0 && r.lines.at(-2) === `feedback: could not send with gh (${klass}) — open this link to post it yourself:`, JSON.stringify(r.lines));
      expect(`${name} one link`, link.startsWith(newIssueUrl()) && link.length < MAX_URL, `${link.length} characters`);
      const q = new URL(link).searchParams;
      expect(`${name} link carries the report`, q.get("labels") === LABEL && q.get("title").startsWith("dod feedback:"), JSON.stringify([q.get("labels"), q.get("title")]));
      expect(`${name} note`, readFileSync(w.planFile, "utf8").includes(`- 2026-09-20 · note · feedback link printed · ${klass}`), "no note");
      if (name === "gh-stderr-hidden") expect("gh-stderr-hidden keeps gh quiet", !r.lines.join("\n").includes(secret) && !readFileSync(w.planFile, "utf8").includes(secret), "gh output leaked");
      clearGhEnv();
    }
    // gh exits 0 but prints no URL: the issue probably exists, so no link is offered
    const root = temp();
    const w = world(root, {}, { record: undefined, env: { GH_STDOUT: "something else entirely" } });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20) });
    expect("gh-no-url", r.code === 0 && r.lines.at(-1) === `feedback: gh reported success but printed no issue URL — check ${issuesUrl()}?q=label%3A${LABEL}` && !r.lines.some((l) => l.includes("issues/new")), JSON.stringify(r.lines));
    expect("gh-no-url note", readFileSync(w.planFile, "utf8").includes("- 2026-09-20 · note · feedback sent · no URL returned"), "no note");
    clearGhEnv();
    // the cut: a body far past the URL limit still yields one URL under the cap, marked as cut
    const long = fallbackUrl("dod feedback: 50 % prediction · L feature · below target", "x".repeat(40000));
    expect("gh fallback cuts the body", long.length <= MAX_URL && decodeURIComponent(new URL(long).searchParams.get("body")).endsWith(" … (cut)"), `${long.length} characters`);
  }

  // ---- D8: one Log line, nothing else in the plan, and never twice by accident
  {
    const root = temp();
    const w = world(root, {}, { record: undefined, env: { GH_STDOUT: ISSUE } });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const before = readFileSync(w.planFile, "utf8");
    const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20) });
    const after = readFileSync(w.planFile, "utf8");
    expect("log-note appends exactly one line", after === `${before.replace(/\n*$/, "\n")}- 2026-09-20 · note · feedback sent · ${ISSUE}\n`, JSON.stringify(after.slice(before.length - 10)));
    const reparsed = parsePlan(after, w.planFile);
    reparsed.reviews = parseReviews(readFileSync(join(w.store, `${w.slug}.reviews.md`), "utf8"));
    const checked = checkPlan(reparsed);
    expect("log-note keeps --check passing", checked.problems.length === 0, JSON.stringify(checked.problems));
    const second = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20) });
    expect("double-send refused", second.code === 1 && second.lines.at(-1) === `feedback: ${w.slug} already has feedback — pass --again to send another` && w.calls().length === 1, JSON.stringify(second.lines));
    const third = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, again: true, now: () => new Date(2026, 8, 20) });
    expect("double-send with --again", third.code === 0 && w.calls().length === 2, JSON.stringify(third.lines));
    clearGhEnv();
  }

  // ---- D9: only closed plans, and only plans that exist
  {
    const root = temp();
    const w = world(root, { status: "in-progress" }, { record: undefined });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh });
    expect("not-done", r.code === 1 && r.lines.at(-1) === `feedback: ${w.slug} is in-progress — feedback is sent after close` && w.calls().length === 0, JSON.stringify(r.lines));
    const d = draft(w.slug, { dir: w.store, home: w.home });
    expect("not-done refuses a draft too", d.code === 1 && d.error.includes("feedback is sent after close"), d.error);
    const u = await send("nowhere", { dir: w.store, home: w.home, gh: w.gh });
    expect("unknown-slug", u.code === 1 && u.lines.at(-1) === `no plan nowhere in ${w.store}`, JSON.stringify(u.lines));
    clearGhEnv();
  }

  // ---- D10: the record's shape, its defaults and its warnings
  {
    const key = "/x/store";
    expect("record valid", JSON.stringify(readConsent(JSON.stringify({ version: 1, stores: { [key]: { consent: "auto", detail: "reasons", asked: "2026-09-01" } } }), key)) === JSON.stringify({ consent: "auto", detail: "reasons", asked: "2026-09-01", warnings: [], json: true }), "");
    const missing = readConsent(JSON.stringify({ version: 1, stores: { [key]: {} } }), key);
    expect("record defaults", missing.consent === "off" && missing.detail === "numbers" && missing.asked === "never" && missing.warnings.length === 0, JSON.stringify(missing));
    const nasty = readConsent(JSON.stringify({ version: 1, stores: { [key]: { consent: `\u001B[2J\u202E${"n".repeat(200)}`, detail: "loud", asked: "yesterday" } } }), key);
    expect("record quotes are printable and short", nasty.warnings.length === 3 && nasty.warnings.every((w2) => /^[\x20-\x7e·→—✗…]*$/.test(w2)), JSON.stringify(nasty.warnings));
    expect("record shows the escapes", nasty.warnings[0].includes("<U+001B>") && nasty.warnings[0].includes("<U+202E>") && nasty.warnings[0].split('"')[1].length <= 40, JSON.stringify(nasty.warnings[0]));
    expect("record invalid asked", nasty.asked === "never" && nasty.warnings[2].includes('asked "yesterday"'), JSON.stringify(nasty.warnings[2]));
    if (platform() === "win32") expect("record key case on Windows", storeKey("C:\\Docs\\Store") === storeKey("c:/docs/store"), `${storeKey("C:\\Docs\\Store")} vs ${storeKey("c:/docs/store")}`);
    else expect("record key separators", storeKey("/x/y") === "/x/y", storeKey("/x/y"));
    // usage: one mode, and every option must belong to it
    for (const argv of [["--draft", "a", "--send", "b"], ["--send", "a", "--yes", "--yes"], ["--draft", "a", "--yes"], ["--send", "a", "--detail", "numbers"], ["--profile", "--again"], ["--draft"], ["--nope"], []]) {
      expect(`usage ${argv.join(" ") || "(empty)"}`, parseArgs(argv).usage === true, JSON.stringify(parseArgs(argv)));
    }
    expect("usage line", USAGE.startsWith("usage: dod-feedback.mjs --draft <slug> | --send <slug>"), USAGE);
  }

  // ---- D11: no network code at all
  {
    const src = readFileSync(SELF, "utf8");
    const netImport = /from\s+["']node:(http|https|net|dns|tls)["']|require\(["']node:(http|https|net|dns|tls)["']\)|["']undici["']/;
    expect("import-scan", !netImport.test(src), "a network module is imported");
    // built from pieces so the scan does not find its own needle
    expect("import-scan no fetch", !src.includes("fet" + "ch("), "the source calls fetch");
  }

  // ---- D15: --set-consent writes one entry and leaves every other alone
  {
    const root = temp();
    const w = world(root, {}, { record: undefined });
    rmSync(recordPath(w.home), { force: true });
    const first = setConsent("auto", { dir: w.store, home: w.home, now: () => new Date(2026, 8, 20) });
    const rec = JSON.parse(readFileSync(recordPath(w.home), "utf8"));
    expect("set-consent creates the record", first.code === 0 && rec.version === 1 && Object.keys(rec.stores).length === 1 && rec.stores[storeKey(w.store)].consent === "auto" && rec.stores[storeKey(w.store)].asked === "2026-09-20", JSON.stringify(rec));
    const other = { version: 1, stores: { "/somewhere/else": { consent: "review", detail: "reasons", asked: "2026-01-01" }, ...rec.stores } };
    writeFileSync(recordPath(w.home), JSON.stringify(other, null, 2));
    const storeFilesBefore = readdirSync(w.store).map((f) => [f, readFileSync(join(w.store, f), "utf8")]);
    setConsent("review", { dir: w.store, home: w.home, now: () => new Date(2026, 8, 21) });
    const rec2 = JSON.parse(readFileSync(recordPath(w.home), "utf8"));
    expect("set-consent keeps other stores", JSON.stringify(rec2.stores["/somewhere/else"]) === JSON.stringify(other.stores["/somewhere/else"]) && Object.keys(rec2.stores).length === 2, JSON.stringify(rec2.stores));
    expect("set-consent replaces this store", rec2.stores[storeKey(w.store)].consent === "review" && rec2.stores[storeKey(w.store)].asked === "2026-09-21", JSON.stringify(rec2.stores[storeKey(w.store)]));
    expect("set-consent touches no file in the store", JSON.stringify(readdirSync(w.store).map((f) => [f, readFileSync(join(w.store, f), "utf8")])) === JSON.stringify(storeFilesBefore), "a store file changed");
    // detail is kept unless it is given
    writeFileSync(recordPath(w.home), JSON.stringify({ version: 1, stores: { [storeKey(w.store)]: { consent: "auto", detail: "reasons", asked: "2026-09-01" } } }, null, 2));
    setConsent("review", { dir: w.store, home: w.home, now: () => new Date(2026, 8, 21) });
    expect("detail-kept", JSON.parse(readFileSync(recordPath(w.home), "utf8")).stores[storeKey(w.store)].detail === "reasons", "detail was lost");
    rmSync(recordPath(w.home), { force: true });
    setConsent("review", { dir: w.store, home: w.home, now: () => new Date(2026, 8, 21) });
    expect("detail-kept defaults to numbers", JSON.parse(readFileSync(recordPath(w.home), "utf8")).stores[storeKey(w.store)].detail === "numbers", "a new entry is not numbers");
    // a record that is not valid JSON is never overwritten
    writeFileSync(recordPath(w.home), "{oops");
    const bad = setConsent("auto", { dir: w.store, home: w.home });
    expect("set-consent refuses bad JSON", bad.code === 1 && bad.lines.at(-1) === `feedback: consent record ${RECORD_SHOWN} is not valid JSON — fix or delete it, then run --set-consent again` && readFileSync(recordPath(w.home), "utf8") === "{oops", JSON.stringify(bad.lines));
    // --needs-question: has this store ever been asked?
    rmSync(recordPath(w.home), { force: true });
    expect("needs-question absent", needsQuestion({ dir: w.store, home: w.home }).code === 0, "");
    setConsent("off", { dir: w.store, home: w.home, now: () => new Date(2026, 8, 21) });
    expect("needs-question answered off", needsQuestion({ dir: w.store, home: w.home }).code === 1, "off still counts as answered");
    // auto mode accepts --yes and a matching id, and still refuses one that does not match
    const root2 = temp();
    const w2 = world(root2, {}, { record: undefined, env: { GH_STDOUT: ISSUE } });
    writeFileSync(recordPath(w2.home), JSON.stringify(w2.entry("auto")));
    const id = draft(w2.slug, { dir: w2.store, home: w2.home }).lines.at(-1).replace("draft id: ", "");
    const okYes = await send(w2.slug, { dir: w2.store, home: w2.home, gh: w2.gh, yes: true, now: () => new Date(2026, 8, 20) });
    expect("auto-flags --yes", okYes.code === 0 && w2.calls().length === 1, JSON.stringify(okYes.lines));
    const okId = await send(w2.slug, { dir: w2.store, home: w2.home, gh: w2.gh, draftIdGiven: id, again: true, now: () => new Date(2026, 8, 20) });
    expect("auto-flags matching id", okId.code === 0 && w2.calls().length === 2, JSON.stringify(okId.lines));
    const staleId = await send(w2.slug, { dir: w2.store, home: w2.home, gh: w2.gh, draftIdGiven: "000000000000", again: true });
    expect("auto-flags stale id", staleId.code === 1 && w2.calls().length === 2, JSON.stringify(staleId.lines));
    clearGhEnv();
    // --profile reads the same record
    const pr = profile({ dir: w2.store, home: w2.home });
    expect("profile line", pr.lines.at(-1) === `feedback: consent auto · detail numbers · asked 2026-09-01 · record ${RECORD_SHOWN}`, JSON.stringify(pr.lines));
  }

  // ---- D16: consent is read again as late as possible, and a record write never clobbers another writer
  {
    const root = temp();
    const w = world(root, {}, { record: undefined });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const withdraw = (consent) => () => writeFileSync(recordPath(w.home), JSON.stringify(w.entry(consent)));
    const off = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, hooks: { beforeSpawn: withdraw("off") } });
    expect("consent-race to off", off.code === 1 && off.lines.at(-1) === "feedback: consent changed during the send — nothing sent" && w.calls().length === 0, JSON.stringify(off.lines));
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    const changed = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, hooks: { beforeSpawn: withdraw("review") } });
    expect("consent-race auto to review", changed.code === 1 && changed.lines.at(-1) === "feedback: consent changed during the send — nothing sent" && w.calls().length === 0, JSON.stringify(changed.lines));
    // another writer lands before every compare: three tries, then say so and leave their entry in place
    let n = 0;
    const theirs = { version: 1, stores: { "/theirs": { consent: "review", detail: "numbers", asked: "2026-01-01" } } };
    const r = setConsent("auto", {
      dir: w.store, home: w.home, now: () => new Date(2026, 8, 20),
      hooks: { beforeCompare: () => { n++; writeFileSync(recordPath(w.home), JSON.stringify({ ...theirs, tries: n })); } },
    });
    expect("set-consent-race", r.code === 1 && r.lines.at(-1) === "feedback: consent record changed underneath — run --set-consent again" && n === 3, `${n} attempts: ${JSON.stringify(r.lines)}`);
    expect("set-consent-race keeps the other writer", JSON.parse(readFileSync(recordPath(w.home), "utf8")).stores["/theirs"] !== undefined, "the other writer was lost");
    clearGhEnv();
  }

  // ---- D17: every local failure is one line, the right exit code and the right number of gh calls
  {
    const fail = (code, path) => (p) => { if (p.includes(path)) { const e = new Error("boom"); e.code = code; throw e; } return readFileSync(p, "utf8"); };
    // the consent record cannot be read: nothing is sent, and this is an error, not an off
    let root = temp(); let w = world(root, {}, { record: undefined });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    let r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, hooks: { readFile: fail("EACCES", "feedback-consent.json") } });
    expect("local-failures unreadable record", r.code === 1 && r.lines.at(-1) === "feedback: cannot read the consent record (EACCES) — nothing sent" && w.calls().length === 0, JSON.stringify(r.lines));
    // the plan cannot be read
    r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, hooks: { readFile: fail("EISDIR", `${w.slug}.md`) } });
    expect("local-failures unreadable plan", r.code === 1 && r.lines.at(-1) === `feedback: cannot read ${w.slug}.md (EISDIR)` && w.calls().length === 0, JSON.stringify(r.lines));
    // the reviews file cannot be read: a warning, and the report says so
    root = temp(); w = world(root, { items: 2, extra: [3], amendments: ["- A1 · 2026-09-05 · discovered · +D3 · layer: 7.2 · late"] }, { record: undefined, env: { GH_STDOUT: ISSUE } });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20), hooks: { readFile: fail("EACCES", ".reviews.md") } });
    expect("local-failures unreadable reviews", r.code === 0 && r.lines[0] === `feedback: cannot read ${w.slug}.reviews.md (EACCES) — review rounds reported as unknown` && w.calls().length === 1, JSON.stringify(r.lines));
    expect("local-failures reports unknown rounds", w.calls()[0].stdin.includes("review rounds: unknown"), JSON.stringify(w.calls()[0]?.stdin?.slice(0, 200)));
    clearGhEnv();
    // gh closes its stdin: the body never lands, so it is a gh failure with its own class
    root = temp(); w = world(root, {}, { record: undefined, ghSource: CLOSING_GH });
    writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
    r = await send(w.slug, {
      dir: w.store, home: w.home, gh: w.gh, timeoutMs: 8000, now: () => new Date(2026, 8, 20),
      hooks: { afterReport: (rep) => ({ ...rep, body: `${rep.body}\n${"filler ".repeat(300000)}` }) },
    });
    expect("local-failures gh stdin", r.code === 0 && r.lines.at(-2) === "feedback: could not send with gh (gh stdin failed) — open this link to post it yourself:" && readFileSync(w.planFile, "utf8").includes("feedback link printed · gh stdin failed"), JSON.stringify(r.lines.slice(-2).map((l) => l.slice(0, 90))));
    clearGhEnv();
    // the note cannot be written, once for each of the three outcomes: the exact line to add by hand
    const outcomes = [
      [{ GH_STDOUT: ISSUE }, `sent as ${ISSUE}`, `feedback sent · ${ISSUE}`],
      [{ GH_STDOUT: "nothing useful" }, "sent without a returned URL", "feedback sent · no URL returned"],
      [{ GH_EXIT: "1" }, "printed the link", "feedback link printed · gh exit 1"],
    ];
    for (const [env, outcome, note] of outcomes) {
      root = temp(); w = world(root, {}, { record: undefined, env });
      writeFileSync(recordPath(w.home), JSON.stringify(w.entry("auto")));
      r = await send(w.slug, { dir: w.store, home: w.home, gh: w.gh, now: () => new Date(2026, 8, 20), hooks: { writeNote: () => { const e = new Error("boom"); e.code = "EROFS"; throw e; } } });
      expect(`local-failures note (${outcome.split(" ")[0]} ${outcome.split(" ")[1]})`, r.code === 1 && r.lines.at(-1) === `feedback: ${outcome} but the Log note could not be written (EROFS) — add this line to the Log by hand: - 2026-09-20 · note · ${note}` && w.calls().length === 1, JSON.stringify(r.lines.at(-1)));
      clearGhEnv();
    }
    expect("timeout class at the real timeout", timeoutClass(GH_TIMEOUT_MS) === "gh timed out after 30 s", timeoutClass(GH_TIMEOUT_MS));
  }

  // ---- 13.1: a draft stays fast in a store the leak check has to walk
  {
    const root = temp();
    const store = join(root, "docs", "dod");
    mkdirSync(store, { recursive: true });
    for (let i = 0; i < 1000; i++) writeFileSync(join(store, `filler-plan-${i}.md`), "");
    // two design changes per amendment, so the report is below target and the reasons — and with them the scrub
    // over every slug in the store — are actually rendered; a success report would stop before any of that
    const amendments = Array.from({ length: 50 }, (_, i) => `- A${i + 1} · 2026-09-05 · discovered · +D${501 + i * 2} +D${502 + i * 2} · layer: 7.2 · reason ${i} about C:\\Users\\example\\thing and https://example.com/${i}`);
    writeFileSync(join(store, "big.md"), planText({ slug: "big", items: 500, extra: Array.from({ length: 100 }, (_, i) => 501 + i), amendments }));
    const t0 = Date.now();
    // visibility given as public: this measures the scrub over a big store, not the gh read (0.3.4 D5)
    const d = draft("big", { dir: store, home: join(root, "home"), detail: "reasons", visibility: { state: "public" } });
    const ms = Date.now() - t0;
    console.log(`timing: draft in a 1,000-plan store, 500-item plan, 50 amendments — ${ms} ms (budget 500 ms)`);
    expect("draft-timing", d.code === 0 && (!assertTiming || ms < 500), `${ms} ms`);
    expect("draft-timing scrubs the reasons", !d.lines.join("\n").includes("example.com") && !d.lines.join("\n").includes("C:\\Users"), "a reason kept its path or URL");
  }

  // ---- D12, D13: the documents a reader is sent to must still say what the script does. The items are read and
  // ticked by hand; this only keeps the load-bearing strings from drifting away from the code underneath them.
  {
    const ref = (f) => { try { return readFileSync(join(dirname(SELF), "..", "references", f), "utf8"); } catch { return ""; } };
    const setup = ref("setup.md"), lifecycle = ref("lifecycle.md");
    const skill = (() => { try { return readFileSync(join(dirname(SELF), "..", "SKILL.md"), "utf8"); } catch { return ""; } })();
    // the label must be named as a label: `dod-feedback.mjs` contains the label's own text, so a bare
    // includes() would pass on a document that never mentions the label at all
    expect("docs-sync setup names the destination", setup.includes(issuesUrl()) && new RegExp(`labelled\\s+${LABEL}\\b(?!\\.)`).test(setup), "setup.md lost the destination or the label");
    expect("docs-sync setup names the record", setup.includes(RECORD_SHOWN) && setup.includes("--set-consent") && setup.includes("--needs-question"), "setup.md lost the record or the commands");
    expect("docs-sync setup keeps consent out of git", /never committed/.test(setup) && /gh auth logout/.test(setup), "setup.md lost the privacy or rotation sentence");
    expect("docs-sync lifecycle has all three branches", /\*\*off\*\*/.test(lifecycle) && /\*\*review\*\*/.test(lifecycle) && /\*\*auto\*\*/.test(lifecycle) && lifecycle.includes("--send <slug> --yes --draft-id <id>"), "lifecycle.md close lost a consent branch");
    expect("docs-sync SKILL.md gates the question", skill.includes("--needs-question") && /never under `--autonomous`/.test(skill), "SKILL.md lost the question rule");
    expect("docs-sync SKILL.md stays short", skill.split("\n").length < 500, `${skill.split("\n").length} lines`);
  }

  // ---- feedback-privacy: the ten fp- cases, one count each
  for (const name of Object.keys(FP_CASES)) {
    const [ok, detail] = await runFpCase(name, { temp });
    expect(name, ok, detail);
  }

  // ---- D11: the real gh is never started — run the whole suite again behind a trap on PATH
  if (!process.env.DOD_FEEDBACK_INNER) {
    const root = temp();
    const bin = join(root, "bin");
    mkdirSync(bin, { recursive: true });
    const marker = join(root, "real-gh-was-started");
    writeFileSync(join(bin, "gh"), `#!/bin/sh\necho started > "${marker}"\n`, { mode: 0o755 });
    writeFileSync(join(bin, "gh.cmd"), `@echo started > "${marker}"\r\n`);
    writeFileSync(join(bin, "gh.exe"), ""); // an unrunnable file is still proof the name was resolved here first
    const res = spawnSync(process.execPath, [SELF, "--selftest"], {
      encoding: "utf8",
      env: { ...process.env, DOD_FEEDBACK_INNER: "1", PATH: `${bin}${platform() === "win32" ? ";" : ":"}${process.env.PATH}` },
      timeout: 120000,
    });
    expect("no-real-gh inner run passes", res.status === 0, (res.stdout ?? "").split("\n").filter((l) => l.startsWith("  ✗")).slice(0, 5).join(" | "));
    expect("no-real-gh trap untouched", !existsSync(marker), "the real gh was started");
  }

  return finish();
}

// Run main() only when invoked directly. Both sides are realpath-resolved: a skill installed as a junction or
// symlink invokes the script by the link's path, and a plain compare made every command a silent no-op (field-fixes D7).
const invokedDirectly = (() => { try { return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(SELF); } catch { return false; } })();
if (invokedDirectly) await main(process.argv.slice(2));
