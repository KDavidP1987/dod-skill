#!/usr/bin/env node
// dod-effort — how long a work package took and how many tokens it used, measured from the Claude Code session
// records of this folder, and written as one effort note in the plan's Log.
//
// Built from docs/dod/pm-views.md (D21–D24, D41). The helper reads `<config>/projects` (`<config>` is
// CLAUDE_CONFIG_DIR when set, else `<home>/.claude`), keeps four kinds of field from each record — `timestamp`,
// `cwd`, `message.id` and the `message.usage` counts — and never prints, writes or keeps anything else: no message
// text, no session id, no file name, no path. It spawns no process and makes no network call. The pages never read
// a session record; they read the Log line this helper writes.
//
//   node dod-effort.mjs --since <iso> --until <iso> [--cwd <dir>] [--gap <min>]
//                       [--plan <slug> --package <W<n>.<m>|plan> [--dry-run] [--dir <store>]]
//   node dod-effort.mjs --budget --plan <slug> [--dir <store>] [--cwd <dir>] [--gap <min>]
//                       [--since <iso>] [--start <iso>] [--until <iso>] [--dry-run]
//   node dod-effort.mjs --selftest [--gating | --case <name>]
//
// --budget (north-star D12) measures a plan's planning-and-review share of its effort: planning (first plan
// commit → `start` Log line) against build (`start` → `done`, or now), in counted tokens. It prints the share,
// past 25 % an over-budget line, and writes a `note · budget` Log line that `dod-index.mjs --check` reads; with no
// session records it prints "unmeasured" and exits 0.

import {
  createReadStream, readdirSync, lstatSync, realpathSync, readFileSync, writeFileSync, mkdtempSync, rmSync,
  mkdirSync, existsSync, statSync, utimesSync, symlinkSync, openSync, writeSync, closeSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { join, dirname, resolve, sep, win32, posix } from "node:path";
import { homedir, tmpdir } from "node:os";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { parsePlan, checkPlan, writeAtomic, plainText, resolveStore, PLANNING_BUDGET_PCT } from "./dod-index.mjs";

export const SELF = fileURLToPath(import.meta.url);

export const GAP_DEFAULT = 10;           // minutes (S-9)
export const MAX_WINDOW_DAYS = 31;       // Design › Data 3.1
const MINUTE = 60_000;

const USAGE =
  "usage: dod-effort.mjs --since <iso> --until <iso> [--cwd <dir>] [--gap <min>]\n" +
  "                      [--plan <slug> --package <W<n>.<m>|plan> [--dry-run] [--dir <store>]]\n" +
  "       dod-effort.mjs --budget --plan <slug> [--dir <store>] [--cwd <dir>] [--gap <min>]\n" +
  "                      [--since <iso>] [--start <iso>] [--until <iso>] [--dry-run]\n" +
  "       dod-effort.mjs --selftest [--gating | --case <name>]";

// Every refusal is one line and exit 1. No message carries a path, a file name or a record's text (D23).
export class EffortError extends Error {}
const fail = (line) => { throw new EffortError(`effort: ${line}`); };

// ---------------------------------------------------------------- arguments (Design › Data 3.1)

// ISO 8601 with a date, a time and an offset; an offset-less time is refused, because the window would depend on
// the zone of whoever runs the helper
const ISO_RE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const PACKAGE_RE = /^(?:W\d+\.\d+|plan)$/;

export function parseArgs(argv, { selftest = false } = {}) {
  const a = { since: null, until: null, cwd: null, gap: GAP_DEFAULT, plan: null, pkg: null, dryRun: false, dir: null, config: null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (seen.has(f)) fail(`${plainText(f)} is given twice`);
    seen.add(f);
    if (f === "--dry-run") { a.dryRun = true; continue; }
    const takes = { "--since": "since", "--until": "until", "--cwd": "cwd", "--gap": "gap", "--plan": "plan", "--package": "pkg", "--dir": "dir", "--config": "config" }[f];
    if (!takes) fail(`unknown argument ${plainText(f)}\n${USAGE}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) fail(`${f} needs a value`);
    a[takes] = v; i++;
  }
  // the session folder is chosen by the selftest only: outside it the helper reads <config>/projects (2.1)
  if (a.config !== null && !selftest) fail("--config is accepted only by the selftest");
  for (const k of ["since", "until"]) {
    if (a[k] === null) fail(`--${k} is required\n${USAGE}`);
    if (!ISO_RE.test(a[k]) || Number.isNaN(Date.parse(a[k]))) fail(`--${k} must be an ISO 8601 time with an offset, such as 2026-10-03T09:00:00-04:00 — got ${plainText(a[k])}`);
  }
  a.sinceMs = Date.parse(a.since); a.untilMs = Date.parse(a.until);
  if (a.sinceMs >= a.untilMs) fail("--since must be before --until");
  if (a.untilMs - a.sinceMs > MAX_WINDOW_DAYS * 24 * 60 * MINUTE) fail(`the window is longer than ${MAX_WINDOW_DAYS} days`);
  if (typeof a.gap === "string") {
    if (!/^\d{1,3}$/.test(a.gap) || Number(a.gap) < 1 || Number(a.gap) > 120) fail(`--gap must be a whole number of minutes from 1 to 120 — got ${plainText(a.gap)}`);
    a.gap = Number(a.gap);
  }
  if ((a.plan === null) !== (a.pkg === null)) fail("--plan and --package go together");
  if (a.plan !== null && !SLUG_RE.test(a.plan)) fail(`${plainText(a.plan)} is not a plan slug`);
  if (a.pkg !== null && !PACKAGE_RE.test(a.pkg)) fail(`--package must be W<n>.<m> or plan — got ${plainText(a.pkg)}`);
  if (a.dryRun && a.plan === null) fail("--dry-run goes with --plan");
  if (a.dir !== null && a.plan === null) fail("--dir goes with --plan");
  a.scoped = a.cwd !== null;
  return a;
}

// ---------------------------------------------------------------- the records (D21, D23)

// The only fields kept from a record (D23). Everything else — the message text, the session id, tool input — is
// dropped as each line is parsed; a figure is computed from these and nothing else.
export const KEPT = {
  timestamp: 1, cwd: 1,
  message: { id: 1, usage: { input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1, output_tokens: 1 } },
};
export const pick = (v, spec) => {
  if (spec === 1 || v === null || typeof v !== "object" || Array.isArray(v)) return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (!Object.hasOwn(spec ?? {}, k) /* pmv-mutant:fields */) continue;
    o[k] = pick(x, spec?.[k]);
  }
  return o;
};

// a record belongs to the folder when its cwd is the folder or below it: `relative` neither leaves it ("..") nor
// jumps drive (absolute); Windows paths compare without case (D21)
export function underFolder(folder, cwd, win = process.platform === "win32") {
  if (typeof cwd !== "string" || !cwd) return false;
  const P = win ? win32 : posix;
  const f = win ? folder.toLowerCase() : folder, c = win ? cwd.toLowerCase() : cwd;
  const r = P.relative(P.resolve(f), P.resolve(c));
  return !(r === ".." || r.startsWith(`..${P.sep}`)) && !P.isAbsolute(r);
}

// The session files below <config>/projects, newest first, changed at or after `since`. A link or junction is
// never followed and a file whose real path leaves the folder is never opened (2.1); a file older than the window
// is not opened at all (D24).
export function sessionFiles(projects, sinceMs, skipped) {
  const root = realpathSync(projects);
  const out = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { skipped.n++; return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      let st;
      try { st = lstatSync(p); } catch { skipped.n++; continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (depth < 4) walk(p, depth + 1); continue; }
      if (!st.isFile() || !e.name.endsWith(".jsonl")) continue;
      if (st.mtimeMs < sinceMs) continue;
      out.push({ path: p, mtimeMs: st.mtimeMs });
    }
  };
  walk(root, 0);
  return out.filter((f) => { try { const r = realpathSync(f.path); return r.startsWith(root + sep); } catch { skipped.n++; return false; } })
    .sort((x, y) => y.mtimeMs - x.mtimeMs);
}

// Reads every file as a stream, line by line (D24): a malformed or truncated line is counted in `skipped`, a
// record carrying usage but no message id ends the run (the format changed — no figure is better than a wrong one).
const NO_FOLDER = "the session records folder (<config>/projects) does not exist";
const NO_RECORDS = "no session records for this folder in the window";
export async function measure(a, { config, hooks = {} } = {}) {
  const projects = join(config, "projects");
  if (!existsSync(projects) || !statSync(projects).isDirectory()) fail(NO_FOLDER);
  const folder = resolve(a.cwd ?? process.cwd());
  if (a.cwd !== null && !(existsSync(folder) && statSync(folder).isDirectory())) fail("--cwd is not a folder");
  const skipped = { n: 0 };
  const files = sessionFiles(projects, a.sinceMs, skipped);
  const times = [];
  const seen = new Set();
  const tok = { counted: 0, cacheReads: 0 };
  let used = 0;
  for (const f of files) {
    hooks.opened?.(f.path);
    let matched = false;
    try {
      const stream = hooks.open ? hooks.open(f.path) : createReadStream(f.path, { encoding: "utf8" });
      // readline does not pass a stream error to its iterator: it is caught here and the file counted as skipped
      let streamErr = null;
      const rl = createInterface({ input: stream, crlfDelay: Infinity });
      stream.on("error", (e) => { streamErr = e; rl.close(); });
      for await (const line of rl) {
        hooks.line?.();
        if (!line.trim()) continue;
        let r;
        try { r = pick(JSON.parse(line), KEPT); } catch { skipped.n++; continue; }
        hooks.record?.(r);
        if (r === null || typeof r !== "object") { skipped.n++; continue; }
        if (!underFolder(folder, r.cwd) /* pmv-mutant:cwd-rule */) continue;
        const t = typeof r.timestamp === "string" ? Date.parse(r.timestamp) : NaN;
        if (Number.isNaN(t)) { skipped.n++; continue; }
        if (t < a.sinceMs || t > a.untilMs) continue;
        matched = true;
        times.push(t);
        const u = r.message?.usage;
        if (!u || typeof u !== "object") continue;
        const id = r.message?.id;
        if (typeof id !== "string" || !id) fail("a session record carries token counts but no message id — the record format has changed, so no figure is given");
        // each assistant message is written once per content part, every line with the same id and usage (S-14)
        if (seen.has(id) /* pmv-mutant:dedupe */) continue;
        seen.add(id);
        const n = (k) => (Number.isFinite(u[k]) && u[k] >= 0 ? u[k] : 0);
        tok.counted += n("input_tokens") + n("cache_creation_input_tokens") + n("output_tokens");
        tok.cacheReads += n("cache_read_input_tokens");
      }
      if (streamErr) throw streamErr;
    } catch (e) {
      if (e instanceof EffortError) throw e;
      skipped.n++; // unreadable: counted, never named (D23, D24)
      continue;
    }
    if (matched) used++;
  }
  if (!times.length) fail(NO_RECORDS);
  times.sort((x, y) => x - y);
  const gapMs = a.gap * MINUTE;
  let active = 0;
  for (let k = 1; k < times.length; k++) {
    const d = times[k] - times[k - 1];
    if (d > gapMs /* pmv-mutant:gap-rule */) continue;
    active += d;
  }
  return { activeMs: active, tokens: tok.counted, cacheReads: tok.cacheReads, files: used, skipped: skipped.n, messages: seen.size };
}

// ---------------------------------------------------------------- the line (D21, D22)

export const fmtActive = (ms) => {
  const m = Math.round(ms / MINUTE);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
};
export const fmtK = (n) => Math.round(n / 1000).toLocaleString("en-US");
export function effortLine(r, a) {
  const label = r.skipped > 0 ? "estimated" : "measured";
  return `effort · ${fmtActive(r.activeMs)} ${label} · ${fmtK(r.tokens)} k tokens ${label} · cache reads ${fmtK(r.cacheReads)} k`
    + ` · ${r.files} session file(s) · scope: ${a.scoped ? "--cwd" : "this folder"}${r.skipped > 0 ? ` · skipped ${r.skipped}` : ""}`;
}
// the Log note: the date is --until's own calendar date, in its own offset (Business rules 4.3)
export function logNote(r, a) {
  const label = r.skipped > 0 ? "estimated" : "measured";
  return `- ${a.until.slice(0, 10)} · note · effort · ${a.pkg} · ${fmtActive(r.activeMs)} ${label} · ${fmtK(r.tokens)} k tokens ${label}`;
}

// The note goes in as the last line of `## Log`: before any blank lines that close the section, and before
// whatever section follows (`## Report` on a closed plan).
export function insertInLog(text, note) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  const i = lines.findIndex((l) => /^## Log\s*$/.test(l));
  if (i === -1) return null;
  let j = lines.findIndex((l, k) => k > i && /^## /.test(l));
  if (j === -1) j = lines.length;
  let k = j;
  while (k - 1 > i && lines[k - 1].trim() === "") k--;
  lines.splice(k, 0, note);
  return lines.join(eol);
}

const problemSet = (text, file, check) => new Set(check(parsePlan(text, file)).problems.map(String));

// Writes the note (D22). No lock: an edit landing between the read and the write is refused by writeAtomic's
// `expect`; one landing after the write is caught by the re-read, and reported, never repaired.
export async function writeNote(a, note, io, { hooks = {}, check = (p) => checkPlan(p) } = {}) {
  const store = resolveStore(a.dir ?? undefined);
  const file = join(store, `${a.plan}.md`);
  let text;
  try { text = readFileSync(file, "utf8"); } catch { fail(`no plan ${a.plan} in the store`); }
  const plan = parsePlan(text, file);
  if (a.pkg !== "plan") {
    const leaf = (plan.packages ?? []).find((p) => p.id === a.pkg && p.leaf);
    if (!leaf) fail(`${a.pkg} is not a work package with no sub-packages in ${a.plan}'s Work breakdown`);
  }
  const next = insertInLog(text, note);
  if (next === null) fail(`${a.plan} has no ## Log section`);
  if (a.dryRun) { io.log(note); io.log(`effort: dry run — ${a.plan} not changed`); return 0; }
  const before = problemSet(text, file, check);
  await hooks.beforeWrite?.();
  if (!writeAtomic(file, next, { expect: text })) fail("the plan changed while the line was written — check its Log");
  await hooks.afterWrite?.();
  let after = null;
  try { after = readFileSync(file, "utf8"); } catch { /* gone: reported below */ }
  if (after !== next /* pmv-mutant:reread */) fail("the plan changed while the line was written — check its Log");
  const added = [...problemSet(after, file, check)].filter((p) => !before.has(p));
  if (added.length /* pmv-mutant:restore */) {
    await hooks.beforeRestore?.();
    // restored only when the file still holds exactly the bytes this helper wrote; an edit since is left alone
    if (!writeAtomic(file, text, { expect: next })) fail("the plan changed after the line was written — remove the effort line by hand");
    fail(`the line would add a check problem, so ${a.plan} is restored as it was — ${plainText(added[0]).slice(0, 200)}`);
  }
  io.log(note);
  io.log(`effort: written as the last line of ${a.plan}'s Log`);
  return 0;
}

// ---------------------------------------------------------------- the planning budget (north-star D12)

// Business rule 4.1: PLANNING_BUDGET_PCT (25) lives in dod-index.mjs beside the freeze thresholds, so `--check`
// and this helper read one number. Business rule 4.3: the budget is measured from the plan's first commit to its
// `start` Log line. The helper spawns no process (10.1), so it cannot ask git for the first commit: the author
// passes it as --since (`git log --diff-filter=A --format=%aI -- docs/dod/<slug>.md`), else the window opens at
// the local midnight of the plan's first Log line.
export const BUDGET_MESSAGES = {
  share: "planning share: <p> % of measured effort (planning <a> · build <b>)",
  over: "planning over budget: <p> % (budget <budget> %) — freeze the plan and build",
  unmeasured: "planning share: unmeasured (<why>)",
  noRecords: "no session records",
  noStart: "the plan has no start Log line",
  emptyPlanning: "the planning window is empty — give --since and --start",
  emptyBuild: "the build window is empty — give --start",
  noTokens: "no token counts",
  sameDay: "the plan started the day it was written — give --since and --start",
};
const fmtB = (key, vals = {}) => BUDGET_MESSAGES[key].replace(/<([A-Za-z]+)>/g, (m, k) => (k in vals ? String(vals[k]) : m));

export function parseBudgetArgs(argv, { selftest = false } = {}) {
  const a = { plan: null, dir: null, cwd: null, gap: GAP_DEFAULT, since: null, start: null, until: null, dryRun: false, config: null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (seen.has(f)) fail(`${plainText(f)} is given twice`);
    seen.add(f);
    if (f === "--budget") continue;
    if (f === "--dry-run") { a.dryRun = true; continue; }
    const takes = { "--plan": "plan", "--dir": "dir", "--cwd": "cwd", "--gap": "gap", "--since": "since", "--start": "start", "--until": "until", "--config": "config" }[f];
    if (!takes) fail(`unknown argument ${plainText(f)}\n${USAGE}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) fail(`${f} needs a value`);
    a[takes] = v; i++;
  }
  if (a.config !== null && !selftest) fail("--config is accepted only by the selftest");
  if (a.plan === null) fail(`--budget needs --plan <slug>\n${USAGE}`);
  if (!SLUG_RE.test(a.plan)) fail(`${plainText(a.plan)} is not a plan slug`);
  for (const k of ["since", "start", "until"]) {
    if (a[k] !== null && (!ISO_RE.test(a[k]) || Number.isNaN(Date.parse(a[k])))) fail(`--${k} must be an ISO 8601 time with an offset, such as 2026-10-03T09:00:00-04:00 — got ${plainText(a[k])}`);
  }
  if (typeof a.gap === "string") {
    if (!/^\d{1,3}$/.test(a.gap) || Number(a.gap) < 1 || Number(a.gap) > 120) fail(`--gap must be a whole number of minutes from 1 to 120 — got ${plainText(a.gap)}`);
    a.gap = Number(a.gap);
  }
  return a;
}

// local midnight of a Log date, `days` later
const dayMs = (date, days = 0) => { const [y, m, d] = date.split("-").map(Number); return new Date(y, m - 1, d + days).getTime(); };
const localDate = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// The two windows (business rule 4.3). Log lines carry dates, not times: without --start the start day counts as
// planning (the build window opens the next local midnight), so a same-day start reads high, never low; without
// --until a closed plan's build ends at the midnight after its `done` line, an open one's now.
export function budgetWindows(plan, text, a, now = Date.now()) {
  const lines = text.split(/\r?\n/);
  let first = null;
  for (let k = lines.findIndex((l) => /^## Log\s*$/.test(l)) + 1; k > 0 && k < lines.length && !/^## /.test(lines[k]); k++) {
    const m = lines[k].match(/^- (\d{4}-\d{2}-\d{2}) · /);
    if (m) { first = m[1]; break; }
  }
  const start = plan.transitions.find((t) => t.status === "in-progress" && /^start$/.test(t.detail));
  if (!start && a.start === null) return { why: "noStart" };
  // a same-day start read from dates alone would count the whole start day, build included, as planning
  if (/* ns-mutant:budget-same-day */a.since === null && a.start === null && first !== null && first === start.date) return { why: "sameDay" };
  const last = plan.transitions.at(-1);
  const sinceMs = a.since !== null ? Date.parse(a.since) : first !== null ? dayMs(first) : null;
  const startMs = a.start !== null ? Date.parse(a.start) : dayMs(start.date, 1);
  const untilMs = a.until !== null ? Date.parse(a.until) : last?.status === "done" ? dayMs(last.date, 1) : now;
  if (sinceMs === null || sinceMs >= startMs) return { why: "emptyPlanning" };
  if (/* ns-mutant:budget-build */startMs >= untilMs) return { why: "emptyBuild" };
  return { sinceMs, startMs, untilMs };
}

const MISSING = new Set([`effort: ${NO_FOLDER}`, `effort: ${NO_RECORDS}`]);
// one window's counted tokens, or null when it has no session records (6.2: missing records never block)
async function windowTokens(a, sinceMs, untilMs, config, hooks) {
  try { return (await measure({ cwd: a.cwd, gap: a.gap, sinceMs, untilMs }, { config, hooks })).tokens; }
  catch (e) { if (e instanceof EffortError && MISSING.has(e.message)) return null; throw e; }
}

// the share (counted tokens: input + cache creation + output, as the effort line reports them; cache reads are not
// counted) and, past the budget, the warning; the note goes in the plan's Log as an effort note does (12.2)
export async function budget(a, io, { config, hooks = {}, check, now } = {}) {
  const unmeasured = (why) => { io.log(fmtB("unmeasured", { why: BUDGET_MESSAGES[why] })); return 0; };
  const store = resolveStore(a.dir ?? undefined);
  const file = join(store, `${a.plan}.md`);
  let text;
  try { text = readFileSync(file, "utf8"); } catch { fail(`no plan ${a.plan} in the store`); }
  const w = budgetWindows(parsePlan(text, file), text, a, now);
  if (w.why) return unmeasured(w.why);
  if (a.cwd !== null && !(existsSync(resolve(a.cwd)) && statSync(resolve(a.cwd)).isDirectory())) fail("--cwd is not a folder");
  const planning = await windowTokens(a, w.sinceMs, w.startMs, config, hooks);
  const build = await windowTokens(a, w.startMs, w.untilMs, config, hooks);
  if (/* ns-mutant:budget-unmeasured */planning === null || build === null) return unmeasured("noRecords");
  if (planning + build === 0) return unmeasured("noTokens");
  const p = Math.round((planning * 100) / (planning + build));
  io.log(fmtB("share", { p, a: `${fmtK(planning)} k tokens`, b: `${fmtK(build)} k tokens` }));
  if (/* ns-mutant:budget-over */p > PLANNING_BUDGET_PCT) io.log(fmtB("over", { p, budget: PLANNING_BUDGET_PCT }));
  const note = `- ${localDate(now ?? Date.now())} · note · budget · planning ${p} % of measured effort`;
  return await writeNote({ plan: a.plan, pkg: "plan", dir: a.dir, dryRun: a.dryRun }, note, io, { hooks, check });
}

// ---------------------------------------------------------------- main

export async function main(argv, io = console, { selftest = false, hooks = {}, check, now } = {}) {
  try {
    if (argv.includes("--budget")) {
      const b = parseBudgetArgs(argv, { selftest });
      return await budget(b, io, { config: b.config ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), hooks, check, now });
    }
    const a = parseArgs(argv, { selftest });
    const config = a.config ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
    const r = await measure(a, { config, hooks });
    if (a.plan === null) { io.log(effortLine(r, a)); return 0; }
    io.log(effortLine(r, a));
    return await writeNote(a, logNote(r, a), io, { hooks, check });
  } catch (e) {
    if (e instanceof EffortError) { io.error(e.message); return 1; }
    // never echo an unexpected error's text: it may hold a path (D23)
    io.error(`effort: the helper failed (${plainText(String(e?.code ?? e?.name ?? "error"))}) — no figure is given`);
    return 1;
  }
}

// ---------------------------------------------------------------- selftest

export const ASSERTIONS = new Map();
const assertion = (id, fn) => ASSERTIONS.set(id, { id, fn });
// D41: the plants of a gating probe, each a fault its control must catch; the counts are constants
const PLANTS = [];
const plant = (probe, name, run) => PLANTS.push({ probe, name, run });
export const GATING_COUNTS = { "2.1": 2, "3.3": 1, "6.2": 3, "10.1": 1, "10.3": 1, "12.4": 1 };

const TEMP_DIRS = [];
const tempDir = (prefix = "dod-effort-") => { const d = mkdtempSync(join(tmpdir(), prefix)); TEMP_DIRS.push(d); return d; };
const cleanTemps = () => { for (const d of TEMP_DIRS.reverse()) rmSync(d, { recursive: true, force: true }); TEMP_DIRS.length = 0; };
const write = (p, text) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };

// one fixture world: a config folder, a home, a repository with a sub-folder, a sibling and a parent
function world() {
  const base = tempDir();
  const w = {
    base, config: join(base, "home", ".claude"), home: join(base, "home"),
    repo: join(base, "work", "repo"), sub: join(base, "work", "repo", "pkg"), sibling: join(base, "work", "repo-x"), parent: join(base, "work"),
  };
  for (const d of [w.config, w.sub, w.sibling]) mkdirSync(d, { recursive: true });
  mkdirSync(join(w.config, "projects"), { recursive: true });
  return w;
}
const rec = (o) => JSON.stringify({
  parentUuid: null, isSidechain: false, userType: "external", sessionId: o.session ?? "aaaa1111", version: "2.1.0",
  type: o.usage ? "assistant" : "user", cwd: o.cwd, timestamp: o.t,
  message: o.usage ? { id: o.id, role: "assistant", model: "claude-x", content: [{ type: "text", text: o.text ?? "a reply" }], usage: o.usage }
    : { role: "user", content: o.text ?? "a question" },
});
const U = (i, c, o, r) => ({ input_tokens: i, cache_creation_input_tokens: c, output_tokens: o, cache_read_input_tokens: r, service_tier: "standard" });
// every fixture file is dated inside the test window, as a session file written during it would be
const FIXTURE_MTIME = new Date("2026-10-03T10:59:00Z");
const session = (w, name, lines, sub = "C--work-repo") => { const p = join(w.config, "projects", sub, name); write(p, lines.join("\n") + "\n"); utimesSync(p, FIXTURE_MTIME, FIXTURE_MTIME); return p; };
const WIN = ["--since", "2026-10-03T10:00:00Z", "--until", "2026-10-03T11:00:00Z"];
const run = async (args, w, opts = {}) => {
  const out = [], err = [];
  const code = await main([...args, "--config", w.config], { log: (s) => out.push(s), error: (s) => err.push(s) }, { selftest: true, ...opts });
  return { code, out, err, all: [...out, ...err].join("\n") };
};

// the measurement fixture of D21: answers known by hand
function measureWorld() {
  const w = world();
  const once = U(10_000, 2_000, 3_000, 40_000);
  session(w, "s1.jsonl", [
    rec({ cwd: w.repo, t: "2026-10-03T10:00:00Z", text: "start" }),
    // one assistant message on three lines (one per content part): counted once
    rec({ cwd: w.repo, t: "2026-10-03T10:05:00Z", id: "msg_1", usage: once }),
    rec({ cwd: w.repo, t: "2026-10-03T10:05:00Z", id: "msg_1", usage: once }),
    rec({ cwd: w.repo, t: "2026-10-03T10:05:00Z", id: "msg_1", usage: once }),
    // a 25-minute gap: not active time
    rec({ cwd: w.sub, t: "2026-10-03T10:30:00Z", id: "msg_2", usage: U(1_000, 0, 1_000, 0) }),
    rec({ cwd: w.repo, t: "2026-10-03T10:32:00Z", text: "again" }),
    // one second outside the window
    rec({ cwd: w.repo, t: "2026-10-03T11:00:01Z", id: "msg_late", usage: U(500_000, 0, 0, 0) }),
  ]);
  session(w, "s2.jsonl", [
    rec({ cwd: w.sibling, t: "2026-10-03T10:10:00Z", id: "msg_sib", usage: U(700_000, 0, 0, 0) }),
    rec({ cwd: w.parent, t: "2026-10-03T10:11:00Z", id: "msg_par", usage: U(900_000, 0, 0, 0) }),
  ]);
  session(w, join("s1", "subagents", "agent-a.jsonl"), [
    rec({ cwd: w.repo, t: "2026-10-03T10:06:00Z", id: "msg_3", usage: U(2_000, 0, 1_000, 0) }),
  ]);
  return w;
}

assertion("effort.measure", async (expect) => {
  const w = measureWorld();
  const r = await run([...WIN, "--cwd", w.repo], w);
  // tokens 15,000 + 2,000 + 3,000 = 20 k; cache reads 40 k; active 5 + 1 + 2 = 8 min (10:00→10:05→10:06, 10:30→10:32)
  expect("effort.measure.line", r.code === 0 && r.out[0] === "effort · 8 min measured · 20 k tokens measured · cache reads 40 k · 2 session file(s) · scope: --cwd", r.all);
  const g = await run([...WIN, "--cwd", w.repo, "--gap", "30"], w);
  expect("effort.measure.gap", g.code === 0 && g.out[0].startsWith("effort · 32 min measured"), g.all);
  expect("effort.measure.format", fmtActive(65 * MINUTE) === "1 h 05 min" && fmtActive(59 * MINUTE + 20_000) === "59 min" && fmtK(1_234_567) === "1,235");
  expect("effort.measure.folder", underFolder("C:\\Work\\Repo", "c:\\work\\repo\\pkg", true) && !underFolder("C:\\Work\\Repo", "C:\\Work\\Repo-x", true)
    && !underFolder("C:\\Work\\Repo", "D:\\Work\\Repo", true) && !underFolder("/w/repo", "/w/Repo", false) && underFolder("/w/repo", "/w/repo/..x", false)
    && !underFolder("/w/repo", "/w", false) && !underFolder("/w/repo", undefined, false));
  // no --cwd: the working directory, and the scope word says so without naming it
  const prev = process.cwd();
  try { process.chdir(w.repo); const d = await run(WIN, w); expect("effort.measure.default-scope", d.code === 0 && d.out[0].endsWith("scope: this folder"), d.all); }
  finally { process.chdir(prev); }
});

const PLAN = (log, extra = "") => [
  "---", "dod: 2", "slug: fx", "title: Effort fixture", "status: in-progress", "size: S", "created: 2026-10-01", "---", "",
  "# Effort fixture", "", "## Work breakdown", "- W1 · **Build**", "- W1.1 · **First** · items: D1 · steps: 1", "",
  "## Log", ...log, "", extra,
].join("\n");
function planWorld(log = ["- 2026-10-01 · status → draft · plan"], extra = "") {
  const w = measureWorld();
  w.store = join(w.repo, "docs", "dod");
  w.plan = join(w.store, "fx.md");
  write(w.plan, PLAN(log, extra));
  return w;
}
const PW = (w, ...more) => [...WIN, "--cwd", w.repo, "--plan", "fx", "--dir", w.store, ...more];
const NOTE = "- 2026-10-03 · note · effort · W1.1 · 8 min measured · 20 k tokens measured";
const quiet = () => ({ problems: [] });
const effortNotes = (text) => text.split("\n").filter((l) => /· note · effort ·/.test(l));

assertion("effort.line", async (expect) => {
  const { EFFORT_RE } = await import("./dod-pages.mjs");
  let w = planWorld(["- 2026-10-01 · status → draft · plan", "- 2026-10-02 · status → in-progress · start"], "## Report\n\nnot yet\n");
  let r = await run(PW(w, "--package", "W1.1"), w, { check: quiet });
  const t = readFileSync(w.plan, "utf8").split("\n");
  const at = t.indexOf(NOTE);
  expect("effort.line.written", r.code === 0 && at > t.indexOf("## Log") && t[at - 1] === "- 2026-10-02 · status → in-progress · start" && at < t.indexOf("## Report"), r.all);
  expect("effort.line.grammar", EFFORT_RE.test(NOTE) && EFFORT_RE.test(logNote({ activeMs: 75 * MINUTE, tokens: 1_234_000, skipped: 2 }, { until: "2026-10-03T23:30:00-04:00", pkg: "plan" })));
  // the date is --until's own date: 23:30 at -04:00 is already the 4th in UTC
  expect("effort.line.date", logNote({ activeMs: 0, tokens: 0, skipped: 0 }, { until: "2026-10-03T23:30:00-04:00", pkg: "plan" }).startsWith("- 2026-10-03 · "));
  // --dry-run writes nothing
  w = planWorld();
  const bytes = readFileSync(w.plan, "utf8");
  r = await run(PW(w, "--package", "W1.1", "--dry-run"), w, { check: quiet });
  expect("effort.line.dry-run", r.code === 0 && r.out.includes(NOTE) && readFileSync(w.plan, "utf8") === bytes, r.all);
  // a package that is not a leaf, or not there
  for (const p of ["W9.9", "W1"]) {
    r = await run(PW(w, "--package", p), w, { check: quiet });
    expect(`effort.line.leaf ${p}`, r.code === 1 && readFileSync(w.plan, "utf8") === bytes, r.all);
  }
  // a check problem the line adds: the plan is restored byte for byte, exit 1
  const byText = (p) => ({ problems: JSON.stringify(p).includes("effort · W1.1") ? ["planted problem"] : [] });
  r = await run(PW(w, "--package", "W1.1"), w, { check: byText });
  expect("effort.line.restore", r.code === 1 && readFileSync(w.plan, "utf8") === bytes && /restored/.test(r.err[0] ?? ""), r.all);
  // the same, with an edit landing after the write: left alone, and the user is told to remove the line
  const EDIT = "- 2026-10-03 · note · someone else's edit";
  r = await run(PW(w, "--package", "W1.1"), w, { check: byText, hooks: { beforeRestore: () => writeFileSync(w.plan, readFileSync(w.plan, "utf8") + EDIT + "\n") } });
  const kept = readFileSync(w.plan, "utf8");
  expect("effort.line.restore-race", r.code === 1 && kept.includes(EDIT) && kept.includes(NOTE)
    && r.err[0] === "effort: the plan changed after the line was written — remove the effort line by hand", r.all);
  // an edit landing between the write and the re-read is reported
  w = planWorld();
  r = await run(PW(w, "--package", "W1.1"), w, { check: quiet, hooks: { afterWrite: () => writeFileSync(w.plan, readFileSync(w.plan, "utf8") + EDIT + "\n") } });
  expect("effort.line.reread", r.code === 1 && r.err[0] === "effort: the plan changed while the line was written — check its Log", r.all);
  // two runs interleaved: the second writes inside the first's window; never both succeed with one line kept
  w = planWorld();
  let inner = null;
  const outer = await run(PW(w, "--package", "W1.1"), w, { check: quiet, hooks: { beforeWrite: async () => { inner = await run(PW(w, "--package", "plan"), w, { check: quiet }); } } });
  const notes = effortNotes(readFileSync(w.plan, "utf8"));
  expect("effort.line.interleaved", inner?.code === 0 && outer.code === 1 && notes.length === 1 && notes[0].includes("· plan ·"), JSON.stringify({ inner: inner?.all, outer: outer.all, notes }));
  // the real checker: a well-formed effort note adds no problem
  w = planWorld();
  r = await run(PW(w, "--package", "plan"), w);
  expect("effort.line.real-check", r.code === 0 && effortNotes(readFileSync(w.plan, "utf8")).length === 1, r.all);
});

const FAKE_KEY = ["sk", "ant", "FAKE0123456789abcdef"].join("-"); // assembled at run time: the source holds no key shape (10.3)
const SESSION = "5c4a2392";
async function privacyRun() {
  const w = planWorld();
  session(w, `${SESSION}-0000-4000-8000-000000000000.jsonl`, [
    rec({ cwd: w.repo, t: "2026-10-03T10:20:00Z", session: SESSION, text: `my key is ${FAKE_KEY}` }),
    rec({ cwd: w.repo, t: "2026-10-03T10:21:00Z", session: SESSION, id: "msg_p", usage: U(1_000, 0, 0, 0), text: `echo ${FAKE_KEY}` }),
  ]);
  const kept = [];
  const r = await run(PW(w, "--package", "W1.1"), w, { check: quiet, hooks: { record: (x) => kept.push(x) } });
  const note = effortNotes(readFileSync(w.plan, "utf8")).join("\n");
  return { w, r, kept, note };
}
const leaksIn = (text, w) => [FAKE_KEY, SESSION, w.home, w.repo, w.config, "C--work-repo", ".jsonl"].filter((s) => text.includes(s));
const FORBIDDEN_IMPORT = /\bfrom\s+["'](?:node:)?(?:child_process|http|https|net|tls|dgram|http2)["']|\bimport\s*\(\s*["'](?:node:)?(?:child_process|http|https|net|tls|dgram|http2)["']/;
// read over the module's whole text, so a spawn or a socket cannot arrive unseen; the test samples below are
// assembled, so the source itself never holds one (10.1)
const sourceImportsNetwork = (src) => FORBIDDEN_IMPORT.test(src);
const SAMPLE_SPAWN = 'import { spawn } from "node:' + 'child_process";', SAMPLE_HTTPS = 'const h = await import("node:' + 'https");', SAMPLE_NET = "import net from 'node:" + "net';";

assertion("effort.privacy", async (expect) => {
  const { w, r, kept, note } = await privacyRun();
  expect("effort.privacy.ran", r.code === 0 && note.length > 0, r.all);
  expect("effort.privacy.output", leaksIn(r.all + "\n" + note, w).length === 0, leaksIn(r.all + "\n" + note, w).join(", "));
  // the fields kept from each record are the four of D23 and no other
  const keys = new Set();
  const walk = (o, at) => { for (const [k, v] of Object.entries(o ?? {})) { keys.add(at + k); if (v && typeof v === "object") walk(v, `${at}${k}.`); } };
  for (const x of kept) walk(x, "");
  const allowed = new Set(["timestamp", "cwd", "message", "message.id", "message.usage", ...Object.keys(KEPT.message.usage).map((k) => `message.usage.${k}`)]);
  expect("effort.privacy.fields", kept.length > 0 && [...keys].every((k) => allowed.has(k)) && !JSON.stringify(kept).includes(FAKE_KEY), [...keys].filter((k) => !allowed.has(k)).join(", "));
  // faults print no path either
  const f = await run(["--since", "2026-10-03T10:00:00Z", "--until", "2026-10-03T11:00:00Z", "--cwd", join(w.repo, "nope")], w);
  expect("effort.privacy.fault-text", f.code === 1 && leaksIn(f.all, w).length === 0, f.all);
  expect("effort.privacy.imports", !sourceImportsNetwork(readFileSync(SELF, "utf8")) && sourceImportsNetwork(SAMPLE_SPAWN)
    && sourceImportsNetwork(SAMPLE_HTTPS));
});

// a stream that fails as an unreadable file does (EACCES): the selftest cannot rely on file modes on Windows
const failingStream = () => new Readable({ read() { this.destroy(Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" })); } });

assertion("effort.faults", async (expect) => {
  const one = (r) => r.code === 1 && r.err.length === 1 && r.out.length === 0 && !/measured/.test(r.all);
  // a missing session folder
  let w = world();
  rmSync(join(w.config, "projects"), { recursive: true });
  let r = await run([...WIN, "--cwd", w.repo], w);
  expect("effort.faults.no-folder", one(r), r.all);
  // a malformed line and a truncated last line: a partial result, every figure estimated
  w = measureWorld();
  session(w, "s3.jsonl", [rec({ cwd: w.repo, t: "2026-10-03T10:40:00Z", text: "x" }), "{ not json", rec({ cwd: w.repo, t: "2026-10-03T10:41:00Z", text: "y" }).slice(0, 40)]);
  r = await run([...WIN, "--cwd", w.repo], w);
  expect("effort.faults.truncated", r.code === 0 && /^effort · \d+ min estimated · \d+ k tokens estimated · .* · skipped 2$/.test(r.out[0] ?? "") && !/measured/.test(r.all), r.all);
  // an unreadable file: counted, never named
  w = measureWorld();
  r = await run([...WIN, "--cwd", w.repo], w, { hooks: { open: (p) => (p.endsWith("s2.jsonl") ? failingStream() : createReadStream(p, { encoding: "utf8" })) } });
  expect("effort.faults.unreadable", r.code === 0 && /estimated .* skipped 1$/.test(r.out[0] ?? "") && !/s2\.jsonl/.test(r.all), r.all);
  // a record with token counts and no message id
  w = world();
  session(w, "s.jsonl", [rec({ cwd: w.repo, t: "2026-10-03T10:20:00Z", id: undefined, usage: U(5, 0, 5, 0) })]);
  r = await run([...WIN, "--cwd", w.repo], w);
  expect("effort.faults.no-id", one(r) && /no message id/.test(r.err[0]), r.all);
  // an empty window
  w = measureWorld();
  r = await run(["--since", "2026-10-02T10:00:00Z", "--until", "2026-10-02T11:00:00Z", "--cwd", w.repo], w);
  expect("effort.faults.empty", one(r) && r.err[0] === "effort: no session records for this folder in the window", r.all);
  // argument faults
  const bad = [
    ["--since", "2026-10-03T12:00:00Z", "--until", "2026-10-03T11:00:00Z"],
    ["--since", "2026-09-01T00:00:00Z", "--until", "2026-10-03T00:00:00Z"],
    ["--since", "2026-10-03T10:00:00", "--until", "2026-10-03T11:00:00Z"],
    [...WIN, "--gap", "0"], [...WIN, "--gap", "121"], [...WIN, "--gap", "5.5"],
    [...WIN, "--package", "W1.1"], [...WIN, "--dry-run"], [...WIN, "--plan", "../x", "--package", "plan"], [...WIN, "--wat"], ["--until", "2026-10-03T11:00:00Z"],
    [...WIN, "--gap", "5", "--gap", "6"],
  ];
  for (const b of bad) { r = await run([...b, "--cwd", w.repo], w); expect(`effort.faults.args ${b.slice(-2).join(" ")}`, r.code === 1 && r.err.length >= 1 && r.out.length === 0, r.all); }
  // a file older than the window is never opened
  w = measureWorld();
  const old = session(w, "old.jsonl", [rec({ cwd: w.repo, t: "2026-10-03T10:20:00Z", id: "msg_old", usage: U(1, 0, 0, 0) })]);
  utimesSync(old, new Date("2026-10-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
  const opened = [];
  r = await run([...WIN, "--cwd", w.repo], w, { hooks: { opened: (p) => opened.push(p) } });
  expect("effort.faults.old-unopened", r.code === 0 && opened.length === 3 && !opened.some((p) => p.endsWith("old.jsonl")), JSON.stringify(opened.map((p) => p.slice(-12))));
  // 200 MB of records, read as a stream: the heap grows by less than 64 MB
  w = world();
  const big = join(w.config, "projects", "C--work-repo", "big.jsonl");
  mkdirSync(dirname(big), { recursive: true });
  const filler = "x".repeat(1900);
  const chunk = Array.from({ length: 500 }, (_, k) => rec({ cwd: w.repo, t: `2026-10-03T10:${String(k % 60).padStart(2, "0")}:00Z`, id: "msg_big", usage: U(1, 0, 1, 0), text: filler })).join("\n") + "\n";
  const fd = openSync(big, "w");
  try { let size = 0; while (size < 200 * 1024 * 1024) { size += writeSync(fd, chunk); } } finally { closeSync(fd); }
  utimesSync(big, FIXTURE_MTIME, FIXTURE_MTIME);
  // pm-views A5: measured after a forced collection, so lines already dropped are not counted as growth
  setFlagsFromString("--expose-gc"); const gc = runInNewContext("gc"); setFlagsFromString("--no-expose-gc");
  gc();
  const before = process.memoryUsage().heapUsed;
  let peak = before, k = 0;
  r = await run([...WIN, "--cwd", w.repo], w, { hooks: { line: () => { if (++k % 5000 === 0) { gc(); peak = Math.max(peak, process.memoryUsage().heapUsed); } } } });
  const grew = peak - before;
  expect("effort.faults.volume", r.code === 0 && statSync(big).size >= 200 * 1024 * 1024 && grew < 64 * 1024 * 1024 && k > 80_000,
    `${Math.round(statSync(big).size / 1048576)} MB, ${k} lines, heap grew ${Math.round(grew / 1048576)} MB; ${r.all}`);
  rmSync(big, { force: true });
});

// ns-budget (north-star D12): planning against build, in counted tokens; past 25 % the over-budget line; no
// session records → "unmeasured", exit 0. Times are pinned with --since/--start/--until, or read from the Log.
function budgetWorld({ planning = null, build = null, log, at = {} } = {}) {
  const w = world();
  w.store = join(w.repo, "docs", "dod");
  w.plan = join(w.store, "fx.md");
  write(w.plan, PLAN(log ?? ["- 2026-10-01 · status → draft · plan", "- 2026-10-02 · status → in-progress · start"]));
  const lines = [];
  if (planning !== null) lines.push(rec({ cwd: w.repo, t: at.planning ?? "2026-10-01T12:00:00Z", text: "plan it" }), rec({ cwd: w.sub, t: at.planning ?? "2026-10-01T12:00:00Z", id: "msg_plan", usage: U(planning, 0, 0, 0) }));
  if (at.startDay !== undefined) lines.push(rec({ cwd: w.repo, t: at.startDay[0], id: "msg_day", usage: U(at.startDay[1], 0, 0, 0) }));
  if (build !== null) lines.push(rec({ cwd: w.repo, t: at.build ?? "2026-10-02T12:00:00Z", id: "msg_build", usage: U(0, build / 2, build / 2, 0) }));
  // a sibling folder's tokens are never counted (D21)
  lines.push(rec({ cwd: w.sibling, t: "2026-10-01T13:00:00Z", id: "msg_sib", usage: U(900_000, 0, 0, 0) }));
  session(w, "b.jsonl", lines);
  return w;
}
const BW = ["--since", "2026-10-01T00:00:00Z", "--start", "2026-10-02T00:00:00Z", "--until", "2026-10-03T00:00:00Z"];
const BUD = (w, ...more) => ["--budget", "--plan", "fx", "--dir", w.store, "--cwd", w.repo, ...more];
const BUDGET_NOTE = (p) => new RegExp(`^- \\d{4}-\\d{2}-\\d{2} · note · budget · planning ${p} % of measured effort$`);

assertion("ns-budget", async (expect) => {
  const r = [], info = {};
  const same = (w, bytes) => readFileSync(w.plan, "utf8") === bytes;
  // 30 %: the share, the over-budget line and the note, printed; a dry run changes nothing
  let w = budgetWorld({ planning: 30_000, build: 70_000 });
  let bytes = readFileSync(w.plan, "utf8");
  let x = await run(BUD(w, ...BW, "--dry-run"), w, { check: quiet });
  info.thirty = x.all;
  r.push(x.code === 0 && x.out[0] === "planning share: 30 % of measured effort (planning 30 k tokens · build 70 k tokens)"
    && x.out[1] === "planning over budget: 30 % (budget 25 %) — freeze the plan and build" && BUDGET_NOTE(30).test(x.out[2] ?? "") && same(w, bytes));
  // 20 % and exactly 25 %: no over-budget line
  for (const [pl, bu] of [[20_000, 80_000], [25_000, 75_000]]) {
    w = budgetWorld({ planning: pl, build: bu });
    x = await run(BUD(w, ...BW, "--dry-run"), w, { check: quiet });
    info[`p${pl}`] = x.all;
    r.push(x.code === 0 && x.out[0]?.startsWith(`planning share: ${pl / 1000} % `) && !/over budget/.test(x.all));
  }
  // no session records — none at all, a missing records folder, or none in one window: "unmeasured", exit 0
  const UNMEASURED = "planning share: unmeasured (no session records)";
  for (const [name, o, drop] of [["none", {}, false], ["no-folder", {}, true], ["no-build", { planning: 30_000 }, false], ["no-planning", { build: 70_000 }, false]]) {
    w = budgetWorld(o);
    if (drop) rmSync(join(w.config, "projects"), { recursive: true });
    bytes = readFileSync(w.plan, "utf8");
    x = await run(BUD(w, ...BW), w);
    info[name] = x.all;
    r.push(x.code === 0 && x.out.length === 1 && x.out[0] === UNMEASURED && x.err.length === 0 && same(w, bytes));
  }
  // windows read from the Log: the first line's day opens planning, the start day counts as planning, the build
  // closes at the midnight after `done` — 30 k + 10 k against 60 k is 40 %
  const local = (d, h) => new Date(2026, 9, d, h).toISOString();
  w = budgetWorld({
    planning: 30_000, build: 60_000, at: { planning: local(1, 12), startDay: [local(2, 12), 10_000], build: local(3, 12) },
    log: ["- 2026-10-01 · status → draft · plan", "- 2026-10-02 · status → ready · approve", "- 2026-10-02 · status → in-progress · start", "- 2026-10-03 · status → done · close"],
  });
  x = await run(BUD(w, "--dry-run"), w, { check: quiet });
  info.fromLog = x.all;
  r.push(x.code === 0 && x.out[0] === "planning share: 40 % of measured effort (planning 40 k tokens · build 60 k tokens)" && x.out[1]?.startsWith("planning over budget: 40 %"));
  // started the day it was written, with no times given: unmeasured, never a whole day counted as planning
  w = budgetWorld({ planning: 30_000, build: 70_000, log: ["- 2026-10-02 · status → draft · plan", "- 2026-10-02 · status → in-progress · start"] });
  x = await run(BUD(w, "--dry-run"), w);
  info.sameDay = x.all;
  r.push(x.code === 0 && x.out[0] === "planning share: unmeasured (the plan started the day it was written — give --since and --start)");
  // a plan not yet started: unmeasured, exit 0
  w = budgetWorld({ planning: 30_000, build: 70_000, log: ["- 2026-10-01 · status → draft · plan"] });
  x = await run(BUD(w), w);
  info.noStart = x.all;
  r.push(x.code === 0 && x.out[0] === "planning share: unmeasured (the plan has no start Log line)");
  // written for real: the note is the last Log line and the real checker finds no new problem
  w = budgetWorld({ planning: 30_000, build: 70_000 });
  x = await run(BUD(w, ...BW), w);
  const kept = readFileSync(w.plan, "utf8").split("\n").filter((l) => / · note · budget · /.test(l));
  info.written = x.all;
  r.push(x.code === 0 && kept.length === 1 && BUDGET_NOTE(30).test(kept[0]) && /written as the last line/.test(x.all));
  // the output names no path, session id or folder (D23)
  r.push(!/[\\/]|\.jsonl|aaaa1111/.test(Object.values(info).join("\n").replace(/ \/ /g, "")));
  expect("ns-budget", r.every(Boolean), JSON.stringify({ r, ...info }));
});

// gating plants (D41): each removes nothing — it states the fault and passes only when the control catches it
plant("2.1", "the helper reading outside <config>/projects", async () => {
  const w = world(), outside = tempDir("dod-effort-out-");
  write(join(outside, "x", "s.jsonl"), rec({ cwd: w.repo, t: "2026-10-03T10:20:00Z", id: "msg_o", usage: U(9_000, 0, 0, 0) }) + "\n");
  try { symlinkSync(join(outside, "x"), join(w.config, "projects", "linked"), process.platform === "win32" ? "junction" : "dir"); } catch { return false; }
  session(w, "in.jsonl", [rec({ cwd: w.repo, t: "2026-10-03T10:21:00Z", text: "here" })]);
  const r = await run([...WIN, "--cwd", w.repo], w);
  return r.code === 0 && / 0 k tokens /.test(r.out[0] ?? "");
});
plant("2.1", "--config accepted outside a selftest", async () => {
  const w = world();
  const out = [], err = [];
  const code = await main([...WIN, "--config", w.config], { log: (s) => out.push(s), error: (s) => err.push(s) });
  return code === 1 && err[0] === "effort: --config is accepted only by the selftest";
});
plant("3.3", "the helper writing anything but the Log line", async () => {
  const w = planWorld();
  const before = readFileSync(w.plan, "utf8");
  const r = await run(PW(w, "--package", "W1.1"), w);
  const after = readFileSync(w.plan, "utf8");
  const lines = after.split("\n"), at = lines.indexOf(NOTE);
  if (at === -1) return false;
  lines.splice(at, 1);
  return r.code === 0 && lines.join("\n") === before && readdirSync(w.store).length === 1;
});
plant("6.2", "a truncated session line ending in a measured figure", async () => {
  const w = measureWorld();
  session(w, "t.jsonl", [rec({ cwd: w.repo, t: "2026-10-03T10:40:00Z", text: "x" }).slice(0, 30)]);
  const r = await run([...WIN, "--cwd", w.repo], w);
  return r.code === 0 && !/measured/.test(r.all) && / skipped 1$/.test(r.out[0] ?? "");
});
plant("6.2", "a record without its message id ending in a figure", async () => {
  const w = world();
  session(w, "s.jsonl", [rec({ cwd: w.repo, t: "2026-10-03T10:20:00Z", usage: U(5, 0, 5, 0) })]);
  const r = await run([...WIN, "--cwd", w.repo], w);
  return r.code === 1 && r.out.length === 0;
});
plant("6.2", "a missing session folder ending in a figure", async () => {
  const w = world();
  rmSync(join(w.config, "projects"), { recursive: true });
  const r = await run([...WIN, "--cwd", w.repo], w);
  return r.code === 1 && r.out.length === 0;
});
plant("10.1", "a spawn or network import in the helper", () => !sourceImportsNetwork(readFileSync(SELF, "utf8")) && sourceImportsNetwork(SAMPLE_NET));
plant("10.3", "a fake key in a record reaching any output", async () => { const { w, r, note } = await privacyRun(); return r.code === 0 && leaksIn(r.all + note, w).length === 0; });
plant("12.4", "an empty window reading as a pass", async () => {
  const w = measureWorld();
  const r = await run(["--since", "2026-10-02T10:00:00Z", "--until", "2026-10-02T11:00:00Z", "--cwd", w.repo], w);
  return r.code === 1 && r.out.length === 0;
});

export async function selftest(io = console, { gating = false, only } = {}) {
  let pass = 0, fired = 0, never = 0;
  const failed = [], results = [];
  try {
    if (gating) {
      const byProbe = new Map();
      for (const p of PLANTS) {
        let ok = false;
        try { ok = (await p.run()) === true; } catch { ok = false; }
        const e = byProbe.get(p.probe) ?? { k: 0, caught: 0, missed: [] };
        e.k++; if (ok) e.caught++; else e.missed.push(p.name);
        byProbe.set(p.probe, e);
      }
      for (const [probe, want] of Object.entries(GATING_COUNTS)) {
        const e = byProbe.get(probe) ?? { k: 0, caught: 0, missed: [] };
        io.log(`gating ${probe}: ${e.caught} of ${e.k} plants caught${e.missed.length ? ` — missed: ${e.missed.join("; ")}` : ""}`);
        if (e.k !== want || e.caught !== e.k) failed.push(`gating ${probe}`);
      }
      return failed.length ? 1 : 0;
    }
    const expect = (id, ok, detail = "") => { fired++; results.push([id, Boolean(ok)]); if (ok) pass++; else failed.push(`${id}${detail ? ` — ${plainText(String(detail)).slice(0, 300)}` : ""}`); };
    for (const { id, fn } of ASSERTIONS.values()) {
      const before = fired;
      try { await fn(expect); } catch (e) { failed.push(`${id} — threw ${plainText(String(e?.message ?? e))}`); continue; }
      if (fired === before) { never++; failed.push(`${id} — registered but never asserted`); }
    }
    for (const p of PLANTS) { let ok = false; try { ok = (await p.run()) === true; } catch { ok = false; } expect(`plant ${p.probe} ${p.name}`, ok); }
    const total = pass + failed.length;
    io.log(`dod-effort selftest: ${pass}/${total} cases${failed.length ? ` (${failed.join(" | ")})` : " (all pass)"}`);
    io.log(`checked ${ASSERTIONS.size} assertions · ${PLANTS.length} plants · ${fired} fired · ${never} never asserted`);
    // north-star: `--case <name>` runs the whole suite, then answers for the named case alone; an unknown name is a
    // failure, never a silent pass
    if (only !== undefined) {
      const hits = results.filter(([id]) => id === only);
      if (!hits.length) { io.log(`selftest: no case "${plainText(only)}"`); return 1; }
      const ok = hits.every(([, x]) => x);
      io.log(`case ${only}: ${ok ? "pass" : "FAIL"}`);
      return ok ? 0 : 1;
    }
    return failed.length ? 1 : 0;
  } finally {
    cleanTemps();
  }
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === SELF;
if (invoked) {
  const args = process.argv.slice(2);
  const done = (c) => { process.exitCode = c; };
  if (args[0] === "--selftest") {
    const k = args.indexOf("--case"), only = k === -1 ? undefined : args[k + 1];
    const rest = args.filter((a, i) => !(k !== -1 && (i === k || i === k + 1)));
    if (rest.some((a) => !["--selftest", "--gating"].includes(a)) || (k !== -1 && (only === undefined || only.startsWith("--") || rest.includes("--gating")))) { console.error(USAGE); process.exitCode = 1; }
    else selftest({ log: (s) => console.log(s), error: (s) => console.error(s) }, { gating: args.includes("--gating"), only })
      .then(done, (e) => { console.error(`effort: ${plainText(String(e?.message ?? e))}`); process.exitCode = 1; });
  } else {
    main(args, { log: (s) => console.log(s), error: (s) => console.error(s) }).then(done);
  }
}
