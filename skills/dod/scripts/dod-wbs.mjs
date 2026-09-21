#!/usr/bin/env node
// dod-wbs — the work-breakdown views over a plan store: a tree, two exports and two HTML pages.
//
// Built from docs/dod/wbs-view.md. It reads plan files only (never docs/dod/README.md), writes only through
// writeUnderStore, and starts no process, opens no socket and reads no environment variable but the one named
// in ENV_READ (D26). dod-index.mjs stays the referee: this script renders what that one parses.
//
//   node dod-wbs.mjs [--dir <store>] --wbs [--compact] [--versions <n>]
//   node dod-wbs.mjs [--dir <store>] --export csv|md [--out <path>]
//   node dod-wbs.mjs [--dir <store>] --html <slug> [--review] [--out <path>]
//   node dod-wbs.mjs --selftest

import {
  readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdtempSync, realpathSync,
  lstatSync, openSync, fstatSync, closeSync, writeSync, renameSync, unlinkSync, constants,
  symlinkSync, utimesSync, mkdirSync, rmSync,
} from "node:fs";
import { join, basename, dirname, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadPlans, parsePlan, checkPlan, reportNumbers, resolveStore, cleanLine, plainText, RUBRIC, ID_LEGEND } from "./dod-index.mjs";

// ---------------------------------------------------------------- bounds (D31)

export const VERSION_CAP = 8;        // version columns rendered before the elision line (D2)
export const WIDE_COLUMNS = 24;      // beyond this many columns the wide warning is printed (D2)
export const COMPACT_WIDTH = 100;    // the compact form's target width
export const PROGRESS_FROM = 11;     // stores of this many plans or more get progress lines (D11)
export const SLUG_RE = /^[a-z0-9-]{1,64}$/;
export const OUT_MAX = 4096;         // characters in an --out path
export const ENV_READ = "DOD_SELFTEST_TIMING"; // the ONLY environment variable this script reads (D26)

// D12: built from character codes on purpose. A literal control character in this source would be the very
// bug these cases exist to catch, and would break this file instead of failing a test.
const B = String.fromCharCode(92);
const CH = (n) => String.fromCharCode(n);
const NEWLINE = CH(0x0a);
const ESC = CH(0x1b), CR = CH(0x0d), LF = CH(0x0a), NEL = CH(0x85), LS = CH(0x2028), PS = CH(0x2029), CSI = CH(0x9b);
const CONTROL_RE = new RegExp("[" + B + "u0000-" + B + "u001f" + B + "u007f-" + B + "u009f" + B + "u2028" + B + "u2029]");

export const USAGE = [
  "usage: dod-wbs.mjs [--dir <store>] --wbs [--compact] [--versions <n>]",
  "       dod-wbs.mjs [--dir <store>] --export csv|md [--out <path>]",
  "       dod-wbs.mjs [--dir <store>] --html <slug> [--review] [--out <path>]",
  "       dod-wbs.mjs --selftest",
].join("\n");

// Every failure line this script can print (D27). page-check.mjs keeps its own; references/wbs.md holds the
// table both are compared against, so a message reworded here and not there fails messages-match-table (D24).
export const MESSAGES = {
  noStore: "wbs: no plan store at <dir>",
  noPlan: "wbs: no plan <slug> in <dir>",
  noParse: "wbs: <slug>.md does not parse — run dod-index.mjs --check <slug>",
  isPlan: "wbs: <path> is a plan file — exports are never written over plans",
  unreadable: "wbs: cannot read <file> (<code>)",
  outside: "wbs: <path> is outside the store — exports are written under <store>",
  link: "wbs: <path> is a link — refusing to write through it",
  inconsistent: "wbs: the store changed while it was being read — this snapshot is inconsistent",
  badSlug: "wbs: <slug> is not a slug — 1 to 64 characters of a-z, 0-9 and -",
  outTooLong: "wbs: --out path is over 4,096 characters",
};

export const fmt = (key, vars = {}) => {
  let s = MESSAGES[key];
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`<${k}>`, String(v));
  return s;
};

// Every failure leaves through here: exactly one line on stderr, the stated status, no stack trace (D27).
export class WbsError extends Error {
  constructor(line, code = 1) { super(line); this.line = line; this.code = code; }
}
const fail = (key, vars) => { throw new WbsError(fmt(key, vars)); };

// ---------------------------------------------------------------- arguments

export function parseArgs(argv) {
  const a = { dir: null, mode: null, compact: false, versions: null, format: null, slug: null, review: false, out: null };
  const modes = [];
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new WbsError(USAGE); return argv[++i]; };
    switch (v) {
      case "--dir": a.dir = next(); break;
      case "--wbs": modes.push("wbs"); break;
      case "--compact": a.compact = true; break;
      case "--versions": { const v2 = next(); if (v2 === "all") { a.versions = "all"; break; } const n = Number(v2); if (!Number.isInteger(n) || n < 1) throw new WbsError(USAGE); a.versions = n; break; }
      case "--export": modes.push("export"); a.format = next(); break;
      case "--html": modes.push("html"); a.slug = next(); break;
      case "--review": a.review = true; break;
      case "--out": a.out = next(); break;
      case "--selftest": modes.push("selftest"); break;
      default: throw new WbsError(USAGE);
    }
  }
  // exactly one mode — "--wbs --export csv" is a usage error, not a silent precedence rule
  if (modes.length !== 1) throw new WbsError(USAGE);
  a.mode = modes[0];
  if (a.mode === "export" && !["csv", "md"].includes(a.format)) throw new WbsError(USAGE);
  if (a.review && a.mode !== "html") throw new WbsError(USAGE);
  if ((a.compact || a.versions !== null) && a.mode !== "wbs") throw new WbsError(USAGE);
  // D31: the bound checks run before a single file is read
  if (a.mode === "html" && !SLUG_RE.test(a.slug)) fail("badSlug", { slug: plainText(a.slug) });
  if (a.out !== null && a.out.length > OUT_MAX) fail("outTooLong");
  return a;
}

// ---------------------------------------------------------------- reading the store (D13)

// One read per file per snapshot. The counter is what D13 asserts: `reads` must equal the file count, so a
// second pass over the same file — the obvious way to make a roll-up "just work" — fails the scale fixture.
export function readStore(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail("noStore", { dir: plainText(dir) });
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "profile.md" && !f.endsWith(".reviews.md"))
    .sort();
  const out = { dir, reads: 0, plans: [], skipped: 0, bytes: new Map() };
  for (const f of files) {
    const file = join(dir, f);
    let text;
    try { text = readFileSync(file, "utf8"); out.reads++; }
    catch (e) { fail("unreadable", { file: plainText(f), code: e.code ?? "EIO" }); }
    out.bytes.set(f, text);
    const plan = parsePlan(text, file);
    // D11: a `.md` with no frontmatter is not a plan — a note, or an export this command wrote earlier.
    // It is counted and skipped, never an error. A file that HAS frontmatter and still does not parse is a
    // broken plan, which is D27's noParse class, and it is left for the command that names a slug.
    if (plan.parseErrors.includes("no frontmatter")) { out.skipped++; continue; }
    out.plans.push(plan);
  }
  return out;
}

// ---------------------------------------------------------------- the tree (D1, D3, D4, D6)

const KINDS = ["discovered", "corrected", "requested", "emergent", "defect", "external"];

// D3: a node's origin is the kind of the amendment that introduced it, earliest wins; anything in ## Baseline,
// and anything no amendment names, is `baseline`.
export function originOf(plan, id) {
  if (plan.baseline.some((b) => b.id === id)) return "baseline";
  let best = null;
  for (const a of plan.amendments) {
    if (!KINDS.includes(a.kind)) continue;
    if (!a.ops.some((o) => o.replace(/^[+~-]/, "") === id)) continue;
    if (!best || a.n < best.n) best = a;
  }
  return best ? best.kind : "baseline";
}

// D3 for a child row: `- <slug> · <status>` is baseline; `· origin: <kind>` names the amendment kind instead.
const childOrigin = (plan, row) => {
  if (row.origin && row.origin !== "baseline") return row.origin;
  for (const a of plan.amendments) if (KINDS.includes(a.kind) && a.ops.some((o) => o.replace(/^[+~-]/, "") === row.slug)) return a.kind;
  return "baseline";
};

// D6: `verified/total` over CURRENT items. total 0 is not 0 % — it is `—` with a reason, at every level, so a
// parent of empty children never renders NaN either.
export const cell = (verified, total) => (total > 0
  ? { verified, total, pct: Math.round((verified / total) * 100), text: `${verified}/${total} ${Math.round((verified / total) * 100)} %` }
  : { verified: 0, total: 0, pct: null, text: "— no items" });

const sumCells = (cells) => cell(cells.reduce((n, c) => n + c.verified, 0), cells.reduce((n, c) => n + c.total, 0));

// The columns of D1: `baseline`, one per declared version, then `now`. A version column counts the items that
// existed at that version — the Log's `version` lines are the only record of one, so a store with none has two.
export function columnsOf(plan) {
  return ["baseline", ...plan.versions.map((v) => v.label), "now"];
}

const verifiedIds = (plan) => {
  // an item is verified when its last evidence line is a pass (the checker's rule, restated over the parse)
  const last = new Map();
  for (const e of plan.evidence) last.set(e.id, e.result);
  return new Set([...last].filter(([, r]) => r === "pass").map(([id]) => id));
};

function planCells(plan, columns) {
  const ok = verifiedIds(plan);
  const now = cell(plan.items.filter((i) => ok.has(i.id)).length, plan.items.length);
  const base = cell(plan.baseline.filter((i) => ok.has(i.id)).length, plan.baseline.length);
  const out = new Map([["baseline", base], ["now", now]]);
  // a declared version has no per-version item list in the plan grammar, so its column is the item set as it
  // stood when that version was logged: baseline plus every amendment op dated on or before it
  for (const v of plan.versions) {
    const ids = new Set(plan.baseline.map((i) => i.id));
    for (const a of plan.amendments) {
      if (a.date > v.date) continue;
      for (const o of a.ops) {
        const id = o.replace(/^[+~-]/, "");
        if (o.startsWith("+")) ids.add(id); else if (o.startsWith("-")) ids.delete(id);
      }
    }
    const live = plan.items.filter((i) => ids.has(i.id));
    out.set(v.label, cell(live.filter((i) => ok.has(i.id)).length, live.length));
  }
  return out;
}

// D1: store → epics → child plans → work packages, computed from plan files only. Parents' numbers are the sum
// of their leaves, never a figure of their own, which is what makes a roll-up checkable.
export function tree(store) {
  const columns = [...new Set(store.plans.flatMap(columnsOf))];
  const ordered = ["baseline", ...columns.filter((c) => c !== "baseline" && c !== "now"), "now"];
  const bySlug = new Map(store.plans.map((p) => [p.slug, p]));
  const claimed = new Set();

  const packagesOf = (plan) => {
    const rows = (plan.sections["Work breakdown"] ?? []);
    const leaves = [];
    for (const l of rows) {
      const m = l.match(/^- (W\d+\.\d+) · \*\*(.+?)\*\* · items: ([^·]+) · steps: (.+)$/);
      if (!m) continue;
      const ids = m[3].trim().split(/\s+/).filter(Boolean);
      const ok = verifiedIds(plan);
      leaves.push({ kind: "package", id: m[1], name: m[2], origin: "baseline", children: [],
        cells: new Map([["now", cell(ids.filter((d) => ok.has(d)).length, ids.length)]]), ids });
    }
    return leaves;
  };

  const planNode = (plan) => {
    claimed.add(plan.slug);
    const cells = planCells(plan, ordered);
    const kids = store.plans.filter((p) => p.fm.parent === plan.slug && !claimed.has(p.slug)).map(planNode);
    const pkgs = kids.length ? [] : packagesOf(plan);
    const node = { kind: plan.fm.size === "Epic" ? "epic" : "plan", id: plan.slug, name: plan.fm.title ?? plan.slug,
      origin: plan.fm.parent && bySlug.has(plan.fm.parent) ? childOrigin(bySlug.get(plan.fm.parent), { slug: plan.slug, origin: null }) : "baseline",
      status: plan.fm.status, children: [...kids, ...pkgs], cells, self: cells };
    // a parent's columns are the sum of its child plans' when it has any (D1); its own items still count
    if (kids.length) {
      for (const c of ordered) node.cells.set(c, sumCells([cells.get(c) ?? cell(0, 0), ...kids.map((k) => k.cells.get(c) ?? cell(0, 0))]));
    }
    return node;
  };

  const roots = store.plans.filter((p) => !p.fm.parent || !bySlug.has(p.fm.parent)).map(planNode);
  const root = { kind: "store", id: basename(store.dir), name: basename(store.dir), origin: "baseline", children: roots,
    cells: new Map(ordered.map((c) => [c, sumCells(roots.map((r) => r.cells.get(c) ?? cell(0, 0)))])) };
  return { root, columns: ordered, plans: store.plans };
}

// D4: read, render, read again, compare. One recompute on a change; a second change gets the warning line and
// the last complete read — never a half-stale tree, and never a warning for a store nobody touched.
export function snapshot(dir, { reads = readStore } = {}) {
  const first = reads(dir);
  const second = reads(dir);
  const same = (a, b) => a.bytes.size === b.bytes.size && [...a.bytes].every(([f, t]) => b.bytes.get(f) === t);
  if (same(first, second)) return { store: first, tree: tree(first), inconsistent: false };
  const third = reads(dir);
  if (same(second, third)) return { store: second, tree: tree(second), inconsistent: false };
  return { store: third, tree: tree(third), inconsistent: true };
}

// ---------------------------------------------------------------- rendering (D1, D2, D5, D12)

// D12: every string out of a plan crosses into a single-line record through here. cleanLine strips C0/C1 and
// turns every line break into one space, so a title carrying ESC[2K or a CR cannot forge a second line. The
// two exceptions are written down rather than left to the reader: a quoted CSV field (D7) and HTML escaping.
const text1 = (s) => cleanLine(String(s ?? ""));

// D5: the rendered name is the one capped display quantity besides D2's columns. Truncation keeps the marker,
// because a silently cut name and a genuinely short one must not look alike.
export function truncate(s, max) {
  const chars = Array.from(text1(s));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

// D2: the eight most recent version columns, then the elision line. `--versions all` lifts the cap; past
// WIDE_COLUMNS it warns once and still renders every column, because truncating the data to fit a terminal
// would be the one failure a wide view cannot recover from.
export function chooseColumns(columns, versions) {
  const mid = columns.filter((c) => c !== "baseline" && c !== "now");
  const all = versions === "all";
  const keep = all ? mid : mid.slice(Math.max(0, mid.length - (versions ?? VERSION_CAP)));
  return { columns: ["baseline", ...keep, "now"], elided: mid.length - keep.length };
}

const pad = (s, w) => { const n = Array.from(s).length; return n >= w ? s : s + " ".repeat(w - n); };

function walk(node, depth, rows) {
  rows.push({ node, depth });
  for (const c of node.children) walk(c, depth + 1, rows);
  return rows;
}

export function renderTree(t, { compact = false, versions = null, tty = false } = {}) {
  const lines = [];
  const { columns, elided } = chooseColumns(t.columns, versions);
  // D5: not a TTY, or --compact, means three columns — origin, baseline, now — inside COMPACT_WIDTH
  const narrow = compact || !tty;
  const shown = narrow ? ["baseline", "now"] : columns;
  const rows = walk(t.root, 0, []);
  const nameWidth = narrow ? 46 : 52;
  const label = (r) => `${"  ".repeat(r.depth)}${truncate(r.node.name, nameWidth - r.depth * 2)}`;
  const labels = rows.map(label);
  const lw = Math.max(...labels.map((s) => Array.from(s).length), 4);
  // every column is two wider than its widest CELL, not just its heading: a 12-character cell in a
  // 12-wide column runs straight into the next one, which is how "61 %117/205" got rendered once
  const cells = rows.flatMap((r) => shown.map((c) => (r.node.cells.get(c) ?? cell(0, 0)).text));
  const cw = Math.max(...shown.map((c) => Array.from(c).length), ...cells.map((s) => Array.from(s).length)) + 2;
  const ow = Math.max(10, ...rows.map((r) => Array.from(r.node.origin).length + 2));

  lines.push(`${pad("node", lw)}  ${pad("origin", ow)}${shown.map((c) => pad(text1(c), cw)).join("")}`.trimEnd());
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cells = shown.map((c) => pad((r.node.cells.get(c) ?? cell(0, 0)).text, cw)).join("");
    lines.push(`${pad(labels[i], lw)}  ${pad(text1(r.node.origin), ow)}${cells}`.trimEnd());
  }
  if (elided > 0) lines.push(`… ${elided} earlier version(s) not shown — pass --versions all`);
  return lines.join("\n");
}

// D2: printed once, on stderr, and the render still happens — a wide store is not a failure.
export const wideWarning = (n) => `wbs: ${n} version columns — this is wider than most terminals`;

// ---------------------------------------------------------------- the one guarded write (D9, D10)

export const SWEEP_MS = 6 * 60 * 60 * 1000;
const TEMP_RE = /^wbs-\d+-[0-9a-f]{8}\.tmp$/;

// Every component of the path, resolved, plus whether a link was crossed anywhere along it. Resolving the
// deepest EXISTING ancestor and appending the rest is what makes `--out missing-dir/wbs.csv` decidable
// without creating anything first.
function resolveEvery(abs) {
  const chain = [];
  for (let cur = abs; ; cur = dirname(cur)) { chain.unshift(cur); if (dirname(cur) === cur) break; }
  let sawLink = false, deepest = null;
  for (const c of chain) {
    let st;
    try { st = lstatSync(c); } catch { break; }
    if (st.isSymbolicLink()) sawLink = true;
    deepest = c;
  }
  if (deepest === null) return { real: abs, sawLink };
  let base;
  try { base = realpathSync(deepest); }
  catch { return { real: abs, sawLink: true }; } // a broken link on the path: fail closed as a link
  const rest = abs.slice(deepest.length).split(sep).filter(Boolean);
  return { real: rest.length ? join(base, ...rest) : base, sawLink };
}

// D9's three classes, checked in this order so one destination can only ever print one line.
export function classifyTarget(storeDir, target) {
  const storeReal = realpathSync(storeDir);
  const { real, sawLink } = resolveEvery(resolve(target));
  // (a) outside — checked first, which is why a link POINTING outside reports outside, not link
  if (real !== storeReal && !real.startsWith(storeReal + sep)) fail("outside", { path: plainText(target), store: plainText(storeReal) });
  // (b) reached through a link, with its target still inside the store
  if (sawLink) fail("link", { path: plainText(target) });
  // (c) a destination that is a plan, the index, or a reviews file — the invariant, not the hope
  // the index and a reviews file are refused by NAME, whether or not one is there yet: creating a `README.md`
  // in a store that has none fabricates the index, and creating a `<slug>.reviews.md` fabricates a review.
  // Only "is this a plan?" needs the file, because only its content can answer that.
  const name = basename(real);
  const reserved = name === "README.md" || name.endsWith(".reviews.md");
  const isPlanFile = reserved
    || (existsSync(real) && name.endsWith(".md") && !parsePlan(readFileSync(real, "utf8"), real).parseErrors.includes("no frontmatter"));
  if (isPlanFile) fail("isPlan", { path: plainText(target) });
  return real;
}

export function sweepTemps(dir, nowMs) {
  let swept = 0;
  for (const f of readdirSync(dir)) {
    if (!TEMP_RE.test(f)) continue;
    try {
      const st = lstatSync(join(dir, f));
      // a mtime at or after now is FRESH: a skewed clock or a synced store must never make a live writer
      // sweepable, so the comparison is one-sided on purpose
      if (st.mtimeMs >= nowMs) continue;
      if (nowMs - st.mtimeMs > SWEEP_MS) { unlinkSync(join(dir, f)); swept++; }
    } catch { /* another run got there first */ }
  }
  return swept;
}

// `beforeRename` exists for D10 only: D26 forbids this script from starting a process, so the concurrent
// case is proved by interleaving two writers deterministically at the one moment that can tear — between
// the temp file being complete and the rename that publishes it — rather than by racing and hoping.
export function writeUnderStore(storeDir, target, text, { now = Date.now, beforeRename = null } = {}) {
  const real = classifyTarget(storeDir, target);
  const dir = dirname(real);
  sweepTemps(dir, now());
  const tmp = join(dir, `wbs-${process.pid}-${randomBytes(4).toString("hex")}.tmp`);
  // A1: O_NOFOLLOW only where the platform defines it. O_CREAT|O_EXCL is what carries the guarantee
  // everywhere — an existing link at this path makes the open fail EEXIST rather than be written through.
  const flags = constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0);
  const fd = openSync(tmp, flags, 0o600);
  try {
    const a = fstatSync(fd), b = lstatSync(tmp);
    // A1: inodes always; devices only when both stats report one, because Windows' lstat reports dev 0
    // where fstat reports the volume serial, and requiring both there would refuse every write
    const devOk = a.dev && b.dev ? a.dev === b.dev : true;
    if (!(a.ino === b.ino && devOk)) throw new WbsError(fmt("link", { path: plainText(target) }));
    writeSync(fd, Buffer.from(text, "utf8"));
  } catch (e) {
    closeSync(fd);
    try { unlinkSync(tmp); } catch { /* already gone */ }
    throw e;
  }
  closeSync(fd);
  if (beforeRename) beforeRename({ tmp, real });
  renameSync(tmp, real); // the publication is the rename: a reader sees the old file or the new one (D10)
  return real;
}

// ---------------------------------------------------------------- exports (D7, D8, D11)

// D7: the one place D12's single-line rule gives way. A quoted CSV field is not a single-line record, and
// RFC 4180 stops the newline starting a row — so LF survives inside the quotes and every other control
// character still goes.
const CSV_LEAD = new RegExp("^[=+@" + B + "-" + B + "t" + B + "r]");
const csvStrip = new RegExp("[" + B + "u0000-" + B + "u0009" + B + "u000b-" + B + "u001f" + B + "u007f-" + B + "u009f" + B + "u2028" + B + "u2029]", "g");

export function csvCell(value) {
  const raw = String(value ?? "");
  const lead = CSV_LEAD.test(raw) ? "'" : ""; // decided on the ORIGINAL first character
  const body = lead + raw.replace(csvStrip, "");
  return /[",\n]/.test(body) ? `"${body.replaceAll('"', '""')}"` : body;
}

// D8: a title containing `](` must not be able to close the link and open another
const mdText = (s) => text1(s).replace(/([[\]()\\])/g, "\\$1").replaceAll("|", "\\|");

const CSV_HEADER = ["kind", "id", "name", "origin", "status", "column", "verified", "total", "percent"];

function rowsOf(t) {
  // D7/D8: an empty store is the header row alone (and the separator, in markdown). The store node's own
  // all-zero row would otherwise read as data and make "0 plan(s)" look like a store with one empty plan.
  if (!t.plans.length) return [];
  const out = [];
  const visit = (n, depth) => {
    for (const c of t.columns) {
      const v = n.cells.get(c);
      if (!v) continue;
      out.push({ node: n, depth, column: c, cell: v });
    }
    for (const k of n.children) visit(k, depth + 1);
  };
  visit(t.root, 0);
  return out;
}

export const countRows = (t) => rowsOf(t).length;

export function exportCsv(t) {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const r of rowsOf(t)) {
    lines.push([r.node.kind, r.node.id, r.node.name, r.node.origin, r.node.status ?? "",
      r.column, r.cell.total ? r.cell.verified : "", r.cell.total ? r.cell.total : "",
      r.cell.pct === null ? "" : r.cell.pct].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function exportMd(t) {
  const head = `| ${CSV_HEADER.map(mdText).join(" | ")} |`;
  const sep = `|${CSV_HEADER.map(() => "---").join("|")}|`;
  const lines = [head, sep];
  for (const r of rowsOf(t)) {
    const name = r.node.kind === "plan" || r.node.kind === "epic"
      ? `[${mdText(r.node.name)}](${mdText(`${r.node.id}.md`)})`
      : mdText(r.node.name);
    lines.push(`| ${[mdText(r.node.kind), mdText(r.node.id), name, mdText(r.node.origin), mdText(r.node.status ?? ""),
      mdText(r.column), r.cell.total ? r.cell.verified : "", r.cell.total ? r.cell.total : "",
      r.cell.pct === null ? "" : r.cell.pct].join(" | ")} |`);
  }
  return `${lines.join("\n")}\n`;
}

// D11: progress to stderr, one line per plan, only past PROGRESS_FROM; the status line is always the last
// line of stdout. The skipped clause appears only when it counts something, which is why an empty store's
// line is exactly `export: 0 plan(s) · header only`.
export const progressLine = (n, m, slug) => `plan ${n}/${m} · ${text1(slug)}`;

export function statusLine(command, planCount, summary, skipped) {
  if (!planCount && !summary) return `${command}: nothing to do`;
  const tail = skipped ? ` · skipped ${skipped} non-plan file(s)` : "";
  return `${command}: ${planCount} plan(s) · ${summary}${tail}`;
}

// ---------------------------------------------------------------- the HTML pages (D18, D19)
//
// One function builds every string that reaches a page, and it is the only one: `esc` is applied here, at the
// place the surface is built, so a field a later change reads directly cannot arrive unescaped (Business rules
// 2, *every string that reaches a surface*). Nothing is deleted — D12's exception for the pages is that they
// escape rather than strip, so a hostile title stays readable as text.

export const esc = (s) => String(s ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// The page is one file: no `script src`, no `link href`, no font, no image, so opening it makes no request.
const PAGE_CSS = `
:root { color-scheme: light dark; --bg:#fbfbfa; --fg:#1b1b1a; --dim:#55534e; --line:#d9d7d1; --card:#ffffff;
  --ok:#1b5e3a; --warn:#7a4a00; --accent:#1f4f82; }
@media (prefers-color-scheme: dark) { :root { --bg:#16181a; --fg:#eceae5; --dim:#a8a49c; --line:#33363a;
  --card:#1e2124; --ok:#7fd8a4; --warn:#e8b765; --accent:#8fbde8; } }
* { box-sizing: border-box; }
/* plan text carries long unbroken tokens — a review-page URL in a Log note, a path, a hostile string with no
   space in it — and at 375 px one of those is what pushes the document wider than the window (D20) */
body, p, td, th, li, caption { overflow-wrap: anywhere; }
body { margin:0; padding:1.5rem 1rem 4rem; background:var(--bg); color:var(--fg); max-width:60rem;
  font:16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
h1 { font-size:1.5rem; line-height:1.25; margin:0 0 .25rem; }
h2 { font-size:1.15rem; margin:2.25rem 0 .5rem; padding-bottom:.25rem; border-bottom:1px solid var(--line); }
h3 { font-size:1rem; margin:1.25rem 0 .35rem; color:var(--dim); }
p { margin:.4rem 0; }
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.9em; }
.sub { color:var(--dim); margin:0 0 1rem; }
.absent { color:var(--dim); font-style:italic; }
.legend { color:var(--dim); }
.scroll { overflow-x:auto; }
table { border-collapse:collapse; width:100%; min-width:32rem; }
caption { text-align:left; color:var(--dim); padding:.25rem 0; }
th, td { text-align:left; vertical-align:top; padding:.35rem .5rem; border-bottom:1px solid var(--line); }
th { color:var(--dim); font-weight:600; white-space:nowrap; }
td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
tr:target td { background:var(--card); outline:2px solid var(--accent); }
ul.tree { list-style:none; margin:0; padding:0; }
ul.tree li { padding:.2rem 0; border-bottom:1px solid var(--line); display:flex; gap:.5rem; flex-wrap:wrap; }
ul.tree li span.pkg { font-weight:600; }
ul.tree li.lvl2 { padding-left:1.25rem; }
ul.tree li .pct { margin-left:auto; font-variant-numeric:tabular-nums; color:var(--dim); }
a { color:var(--accent); }
a:focus-visible { outline:3px solid var(--accent); outline-offset:2px; border-radius:2px; }
.k { display:inline-block; min-width:5.5rem; color:var(--dim); }
.done { color:var(--ok); } .open { color:var(--warn); }
`.trim();

// A section is present with its rows, or absent **with the reason it is absent** — never a silent empty block,
// which is what D18's fixture is written to catch.
const section = (heading, rows, reason) => `<h2>${esc(heading)}</h2>\n` + (rows && rows.length
  ? rows.join("\n")
  : `<p class="absent">${esc(reason)}</p>`);

const table = (caption, headers, rows) => [
  '<div class="scroll">', `<table><caption>${esc(caption)}</caption>`,
  `<thead><tr>${headers.map((h) => `<th scope="col"${h.num ? ' class="num"' : ""}>${esc(h.text ?? h)}</th>`).join("")}</tr></thead>`,
  `<tbody>${rows.join("")}</tbody>`, "</table>", "</div>",
].join("\n");

// The evidence state of one item, in the checker's own terms: the last line wins, and a tick with no line at
// all is its own state rather than being rounded to either side.
export function evidenceState(plan, item) {
  const lines = plan.evidence.filter((e) => e.id === item.id);
  const last = lines[lines.length - 1];
  if (last?.result === "pass") return { text: `verified ${last.date}`, cls: "done", ok: true };
  if (last?.result === "fail") return { text: `failed ${last.date}`, cls: "open", ok: false };
  if (item.checked) return { text: "checked without evidence", cls: "open", ok: false };
  return { text: "open", cls: "", ok: false };
}

// The package tree of D18: leaves carry their own roll-up, a parent carries the sum of the leaves under it —
// never a figure of its own, which is the same rule the store tree follows.
export function packageRollup(plan) {
  const ok = verifiedIds(plan);
  const byId = new Map(plan.items.map((i) => [i.id, i]));
  const own = (p) => { const live = p.items.filter((d) => byId.has(d)); return cell(live.filter((d) => ok.has(d)).length, live.length); };
  return plan.packages.map((p) => {
    if (p.leaf) return { ...p, cell: own(p) };
    const kids = plan.packages.filter((k) => k.leaf && k.id.startsWith(`${p.id}.`));
    return { ...p, cell: sumCells(kids.map(own)) };
  });
}

// The probe-by-item matrix: the same pointer grammar `--check` reads, so the page cannot claim a mapping the
// checker would not accept. Only rubric 2 states probes; a rubric-1 plan maps layers to items instead, which is
// a reason for the section to be absent, not an empty table.
export function probeMatrix(plan) {
  const rubric = plan.fm.rubric === "2" ? 2 : 1;
  if (rubric !== 2) return { rubric, rows: [] };
  const rows = [];
  for (const r of plan.coverage) {
    if (r.status !== "Considered" || r.n < 2 || r.n > 14) continue;
    const segs = r.pointer.split("›");
    const body = segs.length > 1 ? segs[segs.length - 1] : "";
    const answer = new Map();
    for (const part of body.split(";").map((x) => x.trim()).filter(Boolean)) {
      const pm = part.match(/^(\d+\.\d+)\s+(.+)$/);
      if (!pm) continue;
      const prose = pm[2].match(/^prose:\s*(.*)$/);
      if (prose) answer.set(pm[1], { prose: prose[1].trim(), items: [] });
      else answer.set(pm[1], { prose: null, items: [...pm[2].matchAll(/\bD\d+\b/g)].map((x) => x[0]) });
    }
    const count = RUBRIC[rubric].counts[r.n - 1];
    for (let i = 1; i <= count; i++) {
      const id = `${r.n}.${i}`;
      // no prose and no items is what unmapped means — a separate flag would be a second source of truth
      rows.push({ probe: id, layer: r.layer, gating: RUBRIC[rubric].gating.includes(id), ...(answer.get(id) ?? { prose: null, items: [] }) });
    }
  }
  return { rubric, rows };
}

// The trend of D18: the prediction rate as it stood at each declared version. The denominator at a version is
// the design changes recorded on or before its date, so the line moves only when the plan missed something.
export function rateTrend(plan) {
  const B = plan.baseline.length;
  if (!B) return [];
  const counted = (a) => a.kind === "discovered" || a.kind === "corrected";
  const at = (date) => {
    const G = plan.amendments.filter((a) => counted(a) && (date === null || a.date <= date))
      .reduce((n, a) => n + Math.max(1, a.ops.filter((o) => /^[+~]/.test(o)).length), 0);
    return { baseline: B, changes: G, rate: Math.round((B / (B + G)) * 100) };
  };
  return [
    { label: "baseline", date: plan.fm.baselined ?? "", ...at("0000-00-00") },
    ...plan.versions.map((v) => ({ label: `v${v.label}`, date: v.date, ...at(v.date) })),
    { label: "now", date: "", ...at(null) },
  ];
}

export function renderPlanPage(plan) {
  const ok = verifiedIds(plan);
  const owner = new Map();
  for (const p of plan.packages) if (p.leaf) for (const d of p.items) owner.set(d, p.id);
  const title = plan.fm.title ?? plan.slug;
  const verified = plan.items.filter((i) => ok.has(i.id)).length;
  const rep = reportNumbers(plan);

  const head = [
    `<h1>${esc(title)}</h1>`,
    `<p class="sub"><span class="mono">${esc(plan.slug)}</span> · ${esc(plan.fm.status ?? "?")} · size ${esc(plan.fm.size ?? "?")}`
    + ` · parent ${esc(plan.fm.parent && plan.fm.parent !== "none" ? plan.fm.parent : "none")}`
    // D6: a rate with no baseline and no design change is stated as `none`, not left out. An absent number
    // that is simply missing reads as an oversight; the same principle D19 applies to a whole section.
    + ` · verified ${verified}/${plan.items.length} · prediction rate ${rep.rate == null ? "none" : `${rep.rate} %`}</p>`,
    `<p class="legend mono">${esc(ID_LEGEND)}</p>`,
  ].join("\n");

  const roll = packageRollup(plan);
  const treeRows = roll.length ? [`<ul class="tree">${roll.map((p) => {
    const links = p.leaf ? p.items.filter((d) => plan.items.some((i) => i.id === d)).map((d) => `<a href="#${esc(d)}">${esc(d)}</a>`).join(" ") : "";
    return `<li class="${p.id.includes(".") ? "lvl2" : "lvl1"}"><span class="pkg mono">${esc(p.id)}</span>`
      + `<span>${esc(p.title)}</span>${links ? `<span class="mono">${links}</span>` : ""}`
      + `<span class="pct">${esc(p.cell.text)}</span></li>`;
  }).join("")}</ul>`] : [];

  const itemRows = plan.items.map((i) => {
    const st = evidenceState(plan, i);
    return `<tr id="${esc(i.id)}"><td class="mono">${esc(i.id)}</td><td>${esc(i.title || "—")}</td>`
      + `<td class="mono">${esc(i.type)}</td><td class="${st.cls}">${esc(st.text)}</td>`
      + `<td class="mono">${esc(owner.get(i.id) ?? "—")}</td></tr>`;
  });

  const matrix = probeMatrix(plan);
  const matrixRows = matrix.rows.map((r) => {
    const answer = r.prose !== null ? `prose: ${esc(r.prose)}`
      : r.items.map((d) => `<a href="#${esc(d)}">${esc(d)}</a>`).join(" ") || '<span class="open">not mapped</span>';
    return `<tr><td class="mono">${esc(r.probe)}${r.gating ? " ⛔" : ""}</td><td>${esc(r.layer)}</td><td>${answer}</td></tr>`;
  });

  const byKind = KINDS.map((k) => [k, plan.amendments.filter((a) => a.kind === k)]).filter(([, xs]) => xs.length);
  const amendRows = byKind.map(([k, xs]) => `<h3>${esc(k)} · ${xs.length}</h3>\n` + table(
    `${k} amendments`, ["id", "date", "layer", "ops", "package", "why"],
    xs.map((a) => `<tr><td class="mono">${esc(a.id)}</td><td class="mono">${esc(a.date)}</td>`
      + `<td class="mono">${esc(a.layer)}</td><td class="mono">${esc(a.ops.join(" "))}</td>`
      + `<td class="mono">${esc(a.package ?? "—")}</td><td>${esc(a.why)}</td></tr>`),
  ));

  const trend = rateTrend(plan);
  const trendRows = plan.versions.length && trend.length ? [table(
    "prediction rate by declared version", ["point", "date", { text: "baseline", num: true }, { text: "design changes", num: true }, { text: "rate", num: true }],
    trend.map((t) => `<tr><td class="mono">${esc(t.label)}</td><td class="mono">${esc(t.date)}</td>`
      + `<td class="num">${t.baseline}</td><td class="num">${t.changes}</td><td class="num">${t.rate} %</td></tr>`),
  )] : [];

  const noteRows = plan.notes.map((n) => `<p><span class="k mono">${esc(n.date)}</span>${esc(n.text)}</p>`);

  const body = [
    head,
    section("Work breakdown", treeRows, "this plan has no ## Work breakdown section, so there are no packages to roll up"),
    section("Items", itemRows.length ? [table("every current item", ["id", "title", "type", "evidence", "package"], itemRows)] : [],
      "this plan has no items in its Definition of Done"),
    section("Probe coverage", matrixRows.length ? [table("every probe of this plan's rubric", ["probe", "layer", "answer"], matrixRows)] : [],
      matrix.rubric === 2 ? "no Coverage row is Considered, so no probe is mapped"
        : "this plan is scored by rubric 1, which maps each layer to items rather than each probe"),
    section("Amendments", amendRows, "no amendment has been recorded against this plan"),
    section("Prediction rate", trendRows,
      plan.baseline.length ? `no version is declared in the Log, so there is no trend — the rate is ${rep.rate} %`
        : "this plan has no baseline, so there is no rate to trend"),
    section("Log notes", noteRows, "the Log holds no note lines"),
  ].join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
${PAGE_CSS}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// ---------------------------------------------------------------- the review page (D21, D22)

// `layers.md` is authoritative for probe text and `RUBRIC` for probe counts (Business rules 3), so the page
// reads the document rather than restating it — a probe reworded there is reworded here the same day.
// A3: every path this file reads outside a store is derived from these four constants, and there is exactly
// one `fileURLToPath(import.meta.url)` in the file, so the set of files read is computed rather than claimed.
// The commands read only a store and `layers.md`; `--selftest` additionally reads SELF and the two documents.
export const SELF = fileURLToPath(import.meta.url);
export const SKILL_DIR = dirname(dirname(SELF));
export const REF_DIR = join(SKILL_DIR, "references");
export const LAYERS_MD = join(REF_DIR, "layers.md");

export function readLayers(file = LAYERS_MD) {
  let text;
  try { text = readFileSync(file, "utf8"); }
  catch (e) { fail("unreadable", { file: plainText(file), code: e.code ?? "unknown" }); }
  const names = new Map(), probes = new Map();
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^## (\d{1,2})\. (.+?)\s*$/);
    if (h) { names.set(Number(h[1]), h[2]); continue; }
    const p = line.match(/^- (\d{1,2}\.\d+) (⛔ )?(.+?)\s*$/);
    if (p) probes.set(p[1], { gating: Boolean(p[2]), text: p[3] });
  }
  return { names, probes };
}

// The numbered sentences of one section: `N. text` plus the indented lines that continue it. This is the plan's
// own answer for the layer — what a reviewer is asked to judge — so it is shown whole rather than summarised.
export function numberedSentences(plan, heading) {
  const lines = plan.sections[heading] ?? [];
  const out = [];
  for (const l of lines) {
    const m = l.match(/^(\d+)\. (.+)$/);
    if (m) { out.push({ n: Number(m[1]), text: m[2] }); continue; }
    if (out.length && /^\s+\S/.test(l)) out[out.length - 1].text += ` ${l.trim()}`;
  }
  return out;
}

// A leading Status token on an applicability test would put the word on a page D22 forbids it from, so it is
// stripped — and only when it leads, because the rest of the test is the thing the reviewer must contest.
export const stripStatusToken = (s) => String(s ?? "").replace(/^\s*(?:N\/A|Not applicable)\s*(?:·|:|—|-)?\s*/i, "").trim();

// The pointer's shape is `<heading> [› <sub>] › <probe> <answer>; …`. The heading is what names the section
// whose numbered sentences answer the layer; the last segment carries the per-probe entries.
export function pointerParts(pointer) {
  const segs = String(pointer ?? "").split("›");
  const heading = segs[0].trim();
  const entries = new Map();
  if (segs.length > 1) {
    for (const part of segs[segs.length - 1].split(";").map((x) => x.trim()).filter(Boolean)) {
      const m = part.match(/^(\d+\.\d+)\s+(.+)$/);
      if (!m) continue;
      const prose = m[2].match(/^prose:\s*(.*)$/);
      entries.set(m[1], prose ? { prose: prose[1].trim(), items: [] } : { prose: null, items: [...m[2].matchAll(/\bD\d+\b/g)].map((x) => x[0]) });
    }
  }
  return { heading, entries };
}

export function renderReviewPage(plan, layers = readLayers()) {
  const rubric = plan.fm.rubric === "2" ? 2 : 1;
  const counts = RUBRIC[rubric].counts;
  const byId = new Map(plan.items.map((i) => [i.id, i]));
  const title = plan.fm.title ?? plan.slug;

  const blocks = [];
  for (let n = 1; n <= counts.length; n++) {
    const row = plan.coverage.find((r) => r.n === n);
    const name = row?.layer ?? layers.names.get(n) ?? `Layer ${n}`;
    const ids = Array.from({ length: counts[n - 1] }, (_, i) => `${n}.${i + 1}`);
    const out = [`<h2 id="L${n}">${esc(n)}. ${esc(name)}</h2>`];

    // a layer the author declared not applicable is neither blank nor scored: the test is the claim to contest
    if (row && row.status !== "Considered" && /^N\/?A$/i.test(row.status.replace(/\s/g, ""))) {
      out.push(`<p class="declared">declared not applicable — ${esc(stripStatusToken(row.pointer)) || "<em>no test given</em>"}</p>`);
      out.push(table(`probes of layer ${n}`, ["probe", "what it asks", "the plan's answer"],
        ids.map((p) => `<tr><td class="mono">${esc(p)}${layers.probes.get(p)?.gating ? " ⛔" : ""}</td>`
          + `<td>${esc(layers.probes.get(p)?.text ?? "")}</td><td class="open">not applicable</td></tr>`)));
      blocks.push(out.join("\n"));
      continue;
    }

    const { heading, entries } = pointerParts(row?.pointer ?? "");
    const said = heading ? numberedSentences(plan, heading) : [];
    out.push(said.length
      ? `<h3>What the plan says under “${esc(heading)}”</h3>\n<ol class="said">${said.map((s) => `<li>${esc(s.text)}</li>`).join("")}</ol>`
      : `<p class="absent">the plan writes no numbered sentences under ${esc(heading || "any section")} for this layer</p>`);
    out.push(table(`probes of layer ${n}`, ["probe", "what it asks", "the plan's answer"], ids.map((p) => {
      const e = entries.get(p);
      const answer = !e ? '<span class="open">no answer</span>'
        : e.prose !== null ? esc(e.prose)
        : e.items.length ? e.items.map((d) => (byId.has(d) ? `<a href="#${esc(d)}">${esc(d)}</a>` : `${esc(d)} <span class="open">(not an item of this plan)</span>`)).join(" ")
        : '<span class="open">no answer</span>';
      return `<tr><td class="mono">${esc(p)}${layers.probes.get(p)?.gating ? " ⛔" : ""}</td>`
        + `<td>${esc(layers.probes.get(p)?.text ?? "")}</td><td>${answer}</td></tr>`;
    })));
    blocks.push(out.join("\n"));
  }

  // the items the probes link to, each with its full statement and its evidence, so a link lands on the thing
  // the reviewer needs rather than on an id
  const itemBlocks = plan.items.map((i) => {
    const ev = plan.evidence.filter((e) => e.id === i.id);
    const lines = ev.length
      ? `<ul>${ev.map((e) => `<li class="mono">${esc(e.date)} · ${esc(e.result)} · ${esc(e.type)}: ${esc(e.detail)}</li>`).join("")}</ul>`
      : '<p class="absent">no evidence line yet</p>';
    return `<h3 id="${esc(i.id)}"><span class="mono">${esc(i.id)}</span> ${esc(i.title || "")}</h3>\n`
      + `<p>${esc(i.statement)}</p>\n<p class="mono">${esc(i.type)}: ${esc(i.detail)}</p>\n${lines}`;
  });

  const body = [
    `<h1>Review — ${esc(title)}</h1>`,
    `<p class="sub"><span class="mono">${esc(plan.slug)}</span> · ${esc(plan.fm.status ?? "?")} · size ${esc(plan.fm.size ?? "?")}`
    + ` · parent ${esc(plan.fm.parent && plan.fm.parent !== "none" ? plan.fm.parent : "none")} · ${plan.items.length} item(s)</p>`,
    `<p class="legend mono">${esc(ID_LEGEND)}</p>`,
    `<p class="legend">Every probe of this plan's rubric is below with the plan's own answer. The author's own`
    + ` marking is not on this page — form your own before you look at theirs.</p>`,
    ...blocks,
    `<h2>Items in full</h2>`,
    itemBlocks.length ? itemBlocks.join("\n") : '<p class="absent">this plan has no items in its Definition of Done</p>',
  ].join("\n\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review — ${esc(title)}</title>
<style>
${PAGE_CSS}
ol.said { margin:.25rem 0 .75rem; padding-left:1.25rem; }
ol.said li { padding:.15rem 0; }
.declared { border-left:3px solid var(--warn); padding:.35rem .6rem; margin:.5rem 0; color:var(--fg); }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// ---------------------------------------------------------------- entry

// `reads` exists for D27 only, and for the same reason `beforeRename` does: the inconsistent-snapshot class is
// the one failure class that needs the store to change between two reads, and D26 forbids a second process.
export function main(argv, io = console, { reads = readStore } = {}) {
  const a = parseArgs(argv);
  if (a.mode === "selftest") return selftest(io);
  const dir = resolveStore(a.dir);
  switch (a.mode) {
    case "wbs": {
      const snap = snapshot(dir, { reads });
      if (snap.inconsistent) io.error(fmt("inconsistent"));
      const versions = a.versions;
      const chosen = chooseColumns(snap.tree.columns, versions);
      if (versions === "all" && chosen.columns.length > WIDE_COLUMNS) io.error(wideWarning(chosen.columns.length));
      emitProgress(io, snap.store);
      io.log(renderTree(snap.tree, { compact: a.compact, versions, tty: Boolean(process.stdout.isTTY) }));
      io.log(statusLine("wbs", snap.store.plans.length, `${snap.tree.columns.length} column(s)`, snap.store.skipped));
      return 0;
    }
    case "export": {
      const snap = snapshot(dir);
      if (snap.inconsistent) io.error(fmt("inconsistent"));
      emitProgress(io, snap.store);
      const text = a.format === "csv" ? exportCsv(snap.tree) : exportMd(snap.tree);
      const target = a.out ?? join(dir, a.format === "csv" ? "wbs.csv" : "wbs.md");
      writeUnderStore(dir, target, text);
      // an empty store still writes the file — "nothing to export" must not look like "the command failed".
      // The count is the data rows, not the file's lines: csv has one header and md has a separator too,
      // so counting lines makes the two formats disagree about the same store.
      const rows = snap.store.plans.length ? `${countRows(snap.tree)} row(s)` : "header only";
      io.log(statusLine("export", snap.store.plans.length, rows, snap.store.skipped));
      return 0;
    }
    case "html": {
      // built from that one plan file and nothing else (D18): no store snapshot, no sibling plan, no roll-up
      // borrowed from the tree — so the page a reviewer opens is the plan a reviewer was given. The review
      // page adds exactly one more source, `references/layers.md`, which is authoritative for probe text.
      const file = join(dir, `${a.slug}.md`);
      if (!existsSync(file)) fail("noPlan", { slug: plainText(a.slug), dir: plainText(dir) });
      let text;
      try { text = readFileSync(file, "utf8"); }
      catch (e) { fail("unreadable", { file: plainText(file), code: e.code ?? "unknown" }); }
      const plan = parsePlan(text, file);
      if (plan.parseErrors.length) fail("noParse", { slug: plainText(a.slug) });
      const page = a.review ? renderReviewPage(plan) : renderPlanPage(plan);
      const target = a.out ?? join(dir, `${a.slug}${a.review ? ".review" : ""}.html`);
      writeUnderStore(dir, target, page);
      const summary = a.review
        ? `${plan.items.length} item(s) · ${RUBRIC[plan.fm.rubric === "2" ? 2 : 1].counts.reduce((x, y) => x + y, 0)} probe(s)`
        : `${plan.items.length} item(s) · ${plan.packages.length} package(s)`;
      io.log(statusLine("html", 1, summary, 0));
      return 0;
    }
    default:
      throw new WbsError(USAGE);
  }
}

// D11: to stderr, one line per plan, and only past PROGRESS_FROM — a small store stays quiet
function emitProgress(io, store) {
  if (store.plans.length < PROGRESS_FROM) return;
  store.plans.forEach((p, k) => io.error(progressLine(k + 1, store.plans.length, p.slug)));
}

// ---------------------------------------------------------------- selftest
//
// Every case is registered in ASSERTIONS with an id (D33), so `--selftest --list-assertions` can be compared
// with what actually ran: a checker that silently stops asserting is the failure this registry exists to catch.

export const ASSERTIONS = new Map();
const assertion = (id, fixture, fn) => ASSERTIONS.set(id, { id, fixture, fn });

// Every temp directory the suite makes goes here, and `selftest()` deletes them all before it returns:
// D32's inventory types them `session`, and a `session` path that is still standing when the command
// exits is a leak, not a lifecycle (A13). A case that already deletes its own is unaffected — rmSync
// with `force` on a path that is gone is a no-op.
const TEMP_DIRS = [];
const tempDir = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); TEMP_DIRS.push(d); return d; };

function makeStore(files) {
  const dir = tempDir("dod-wbs-");
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

// a plan file the real parser accepts, built from the pieces each case needs
export function planText(slug, o = {}) {
  const fm = {
    dod: "2", id: `dod-20260919-${slug.replace(/[^a-z0-9]/g, "").slice(0, 6).padEnd(4, "x")}`, slug,
    title: o.title ?? slug, status: o.status ?? "in-progress", size: o.size ?? "M",
    created: "2026-09-19", baselined: "2026-09-19", closed: "none", commit: "abc1234",
    coverage_author: "15/15 layers · 49/49 probes", coverage_reviewer: "15/15 layers · 49/49 probes",
    review: "codex", ...(o.fm ?? {}),
  };
  const items = o.items ?? [];
  const body = items.map((i) => `- [ ] ${i.id} · **${i.title ?? i.id}** ${i.stmt ?? "something is true"} · test: a case`).join("\n");
  const head = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `---\n${head}\n---\n\n# DoD: ${slug}\n\n## Definition of Done\n${body}\n\n## Baseline\n${(o.baseline ?? items).map((i) => `- [ ] ${i.id} · **${i.title ?? i.id}** ${i.stmt ?? "something is true"} · test: a case`).join("\n")}\n\n## Amendments\n${o.amend ?? ""}\n${o.children !== undefined ? `## Children\n${o.children}\n\n` : ""}${o.extra ?? ""}## Log\n- 2026-09-19 · status → draft · plan\n- 2026-09-19 · status → ready · approve\n- 2026-09-19 · status → in-progress · start\n${o.log ?? ""}`;
}

export function selftest(io = console) {
  let pass = 0; const failed = [];
  // D33: what must be true is that every REGISTERED assertion actually asserted something — not that it
  // used its own id as a label. A case that covers three sub-claims names all three; a case that quietly
  // stops checking anything still has to fail.
  let fired = 0, never = 0;
  const expect = (id, ok, detail = "") => { fired++; if (ok) pass++; else failed.push(`${id}${detail ? ` — ${detail}` : ""}`); };
  for (const { id, fn } of ASSERTIONS.values()) {
    const before = fired;
    try { fn(expect); } catch (e) { failed.push(`${id} — threw ${plainText(String(e?.message ?? e))}`); continue; }
    if (fired === before) { never++; failed.push(`${id} — registered but never asserted`); }
  }
  // D33's counts line, in the shape A8 states for a fixture suite. The five checkers under `scripts/checks/`
  // judge a store, a repository or a set of pages, so each of their assertions has a violation that can be
  // planted and must trip it. These cases render, and "the planted violation" has no meaning for one that
  // asserts a column width — so what is counted here is what can be counted honestly: how many assertions the
  // registry holds, how many actually fired, and how many were registered and never asserted anything. The
  // empty clause is a real run against an empty store, not a literal, so it cannot drift from what the command
  // prints.
  const emptyStore = tempDir("dod-wbs-empty-");
  let emptyLine = "(not run)";
  try {
    const out = [];
    main(["--dir", emptyStore, "--wbs"], { log: (s) => out.push(s), error: () => {} });
    emptyLine = out[out.length - 1] ?? "(nothing printed)";
  } catch (e) { emptyLine = `(threw ${plainText(String(e?.message ?? e))})`; }
  finally { rmSync(emptyStore, { recursive: true, force: true }); }
  if (!/^wbs: 0 plan\(s\)/.test(emptyLine)) failed.push(`empty store printed ${JSON.stringify(emptyLine)}, which does not read as a count`);

  for (const d of TEMP_DIRS.reverse()) rmSync(d, { recursive: true, force: true });
  TEMP_DIRS.length = 0;

  const total = pass + failed.length;
  io.log(`dod-wbs selftest: ${pass}/${total} cases${failed.length ? ` (${failed.join(" | ")})` : " (all pass)"}`);
  io.log(`checked ${ASSERTIONS.size} assertions · ${fired} fired · ${never} never asserted · empty: ${emptyLine}`);
  // D13: the timings are printed on every run with the platform and Node version, and asserted only when
  // DOD_SELFTEST_TIMING=assert — so the number is always visible and never fails a correct render on a slow box
  for (const a of ASSERTIONS.values()) if (a.timing) io.log(`  timing: ${a.timing}`);
  return failed.length ? 1 : 0;
}

// --- fixture tree (D1, D2, D3, D5) ------------------------------------------

const I = (n) => Array.from({ length: n }, (_, k) => ({ id: `D${k + 1}` }));
const passes = (ids) => ids.map((d) => `- 2026-09-19 · ${d} · pass · test: a case — ok · abc1234 · claude\n`).join("");

assertion("tree.rollup", "tree", (expect) => {
  const dir = makeStore({
    "epic.md": planText("epic", { size: "Epic", items: I(0), children: "- kid1 · in-progress\n- kid2 · in-progress" }),
    "kid1.md": planText("kid1", { fm: { parent: "epic" }, items: I(4), log: passes(["D1", "D2"]) }),
    "kid2.md": planText("kid2", { fm: { parent: "epic" }, items: I(2), log: passes(["D1"]) }),
    "grand.md": planText("grand", { fm: { parent: "kid1" }, items: I(2), log: passes(["D1", "D2"]) }),
    "solo.md": planText("solo", { items: I(3), log: passes(["D3"]) }),
  });
  const t = snapshot(dir).tree;
  const find = (id, n = t.root) => n.id === id ? n : n.children.map((c) => find(id, c)).find(Boolean);
  const now = (id) => find(id).cells.get("now");
  // every parent equals the sum of its leaves: kid1 4 items (2 verified) + grand 2 (2) = 6/6... 4 verified
  expect("tree.rollup", now("kid1").verified === 4 && now("kid1").total === 6, JSON.stringify(now("kid1")));
  expect("tree.epic-sum", now("epic").verified === 5 && now("epic").total === 8, JSON.stringify(now("epic")));
  expect("tree.store-sum", now(basename(dir)).verified === 6 && now(basename(dir)).total === 11, JSON.stringify(now(basename(dir))));
  expect("tree.depth", (function d(n) { return n.children.length ? 1 + Math.max(...n.children.map(d)) : 1; })(t.root) >= 4);
});

assertion("tree.ignores-index", "tree", (expect) => {
  const files = { "solo.md": planText("solo", { items: I(2), log: passes(["D1"]) }) };
  const withIdx = makeStore({ ...files, "README.md": "# index\n\n| solo | 999/999 | nonsense |\n" });
  const without = makeStore(files);
  const a = renderTree(snapshot(withIdx).tree, {});
  const b = renderTree(snapshot(without).tree, {});
  expect("tree.ignores-index", a.replace(basename(withIdx), "S") === b.replace(basename(without), "S") && !a.includes("999"), a);
  // D1's other half: a store with no epic is store → plan and nothing else. The depth assertion in
  // `tree.rollup` only says four levels are reached; without this one, a renderer that always invented an
  // intermediate level, or collapsed the store row away, would pass both.
  const depth = (n) => (n.children.length ? 1 + Math.max(...n.children.map(depth)) : 1);
  expect("tree.two-levels", depth(snapshot(without).tree.root) === 2, `depth ${depth(snapshot(without).tree.root)} for a one-plan store`);
});

assertion("tree.versions-cap", "tree", (expect) => {
  const vers = (n) => Array.from({ length: n }, (_, k) => `- 2026-09-19 · version · v0.${k + 1}\n`).join("");
  const ten = makeStore({ "p.md": planText("p", { items: I(2), log: passes(["D1"]) + vers(10) }) });
  const t10 = snapshot(ten).tree;
  const capped = chooseColumns(t10.columns, null);
  const all = chooseColumns(t10.columns, "all");
  expect("tree.versions-cap", capped.columns.length === VERSION_CAP + 2 && capped.elided === 2, JSON.stringify(capped.columns));
  expect("tree.versions-all", all.columns.length === 12 && all.elided === 0, JSON.stringify(all.columns));
  expect("tree.versions-elision", renderTree(t10, {}).includes("… 2 earlier version(s) not shown — pass --versions all"), renderTree(t10, {}));
  const thirty = makeStore({ "p.md": planText("p", { items: I(2), log: passes(["D1"]) + vers(30) }) });
  const c30 = chooseColumns(snapshot(thirty).tree.columns, "all");
  expect("tree.versions-wide", c30.columns.length === 32 && c30.columns.length > WIDE_COLUMNS, String(c30.columns.length));
  // D2's third claim, and its `fails when: the warning prints twice`: the column count alone never showed
  // whether the warning was printed at all, let alone once. It goes to stderr, and stdout still gets every
  // column — a warning is not a refusal.
  const wide = runHtml(thirty, "--wbs", "--versions", "all");
  const warned = wide.err.filter((l) => l.includes("wider than most terminals"));
  expect("tree.versions-wide-warns-once", wide.code === 0 && warned.length === 1 && warned[0] === wideWarning(32),
    JSON.stringify({ code: wide.code, warned }));
  const narrow = runHtml(ten, "--wbs", "--versions", "all");
  expect("tree.versions-narrow-silent", narrow.err.every((l) => !l.includes("wider than most terminals")), JSON.stringify(narrow.err));
});

assertion("compact.width", "tree", (expect) => {
  // D5: 100 columns for a 40-character slug at depth 4, and a 60-character one truncated but still inside
  const name = (n, ch) => ch.repeat(n);
  const dir = makeStore({
    "e.md": planText("e", { size: "Epic", title: name(40, "a"), items: I(0), children: "- k1 · in-progress" }),
    "k1.md": planText("k1", { fm: { parent: "e", title: name(40, "b") }, items: I(0) }),
    "k2.md": planText("k2", { fm: { parent: "k1", title: name(40, "c") }, items: I(2), log: passes(["D1"]) }),
    "k3.md": planText("k3", { fm: { parent: "k2", title: name(60, "d") }, items: I(2) }),
  });
  const t = snapshot(dir).tree;
  const compact = renderTree(t, { compact: true });
  const lines = compact.split(NEWLINE);
  // the bound is D5's literal 100, not COMPACT_WIDTH: measuring the renderer against the constant it renders
  // from is an oracle that moves with the code, and widening the constant would have passed silently.
  const over = lines.filter((l) => Array.from(l).length > 100);
  expect("compact.width", over.length === 0, JSON.stringify(over.map((l) => Array.from(l).length)));
  expect("compact.width-is-the-stated-one", COMPACT_WIDTH === 100, `COMPACT_WIDTH is ${COMPACT_WIDTH}, D5 states 100`);
  const long = lines.find((l) => l.includes("dddd"));
  expect("compact.truncated", Boolean(long) && long.includes("…"), JSON.stringify(long));
  const full = renderTree(t, { compact: false, tty: true });
  expect("compact.narrower", renderTree(t, { compact: true }).length <= full.length, "compact must not be wider than the full matrix");
  // D5's first clause — "with stdout not a TTY, OR with --compact". Not a TTY has to give the same three
  // columns as --compact, or the flag is the only way to get the narrow form and a piped run prints the wide
  // matrix into whatever is reading it.
  expect("compact.not-a-tty", renderTree(t, { compact: false, tty: false }) === compact, "a non-TTY run must render exactly the compact form");
});

assertion("tree.origin", "tree", (expect) => {
  const amend = [
    "- A1 · 2026-09-19 · discovered · +D3 · layer: 7.2 · a",
    "- A2 · 2026-09-19 · corrected · ~D4 · layer: 4.1 · b",
    "- A3 · 2026-09-19 · requested · +D5 · layer: — · c",
    "- A4 · 2026-09-19 · emergent · +D6 · layer: — · d · finding: seen in run 42",
    "- A5 · 2026-09-19 · defect · +D7 · layer: — · e",
    "- A6 · 2026-09-19 · external · +D8 · layer: — · f",
    // A7's kind differs from A1's on purpose: while both said `discovered`, earliest and latest were the same
    // answer and `tree.origin-earliest` could not tell them apart — the assertion passed either way.
    "- A7 · 2026-09-19 · corrected · ~D3 · layer: 7.2 · names D3 again, later, with a different kind",
  ].join("\n");
  const dir = makeStore({ "p.md": planText("p", { items: I(8), baseline: I(2), amend }) });
  const p = snapshot(dir).store.plans[0];
  const got = Object.fromEntries(I(8).map(({ id }) => [id, originOf(p, id)]));
  expect("tree.origin", got.D1 === "baseline" && got.D2 === "baseline" && got.D3 === "discovered" && got.D4 === "corrected"
    && got.D5 === "requested" && got.D6 === "emergent" && got.D7 === "defect" && got.D8 === "external", JSON.stringify(got));
  expect("tree.origin-earliest", originOf(p, "D3") === "discovered", "an item named twice takes the earliest amendment");
});

// --- fixture zero-items (D6) ------------------------------------------------

assertion("zero.leaf", "zero-items", (expect) => {
  const dir = makeStore({ "empty.md": planText("empty", { items: I(0) }) });
  const t = snapshot(dir).tree;
  const c = t.root.children[0].cells.get("now");
  expect("zero.leaf", c.pct === null && c.text === "— no items", JSON.stringify(c));
});

assertion("zero.parent", "zero-items", (expect) => {
  const dir = makeStore({
    "e.md": planText("e", { size: "Epic", items: I(0), children: "- a · in-progress\n- b · in-progress\n- c · in-progress" }),
    "a.md": planText("a", { fm: { parent: "e" }, items: I(0) }),
    "b.md": planText("b", { fm: { parent: "e" }, items: I(0) }),
    "c.md": planText("c", { fm: { parent: "e" }, items: I(0) }),
  });
  const out = renderTree(snapshot(dir).tree, {});
  expect("zero.parent", !/NaN|Infinity|0 %/.test(out) && out.includes("— no items"), out);
});

assertion("zero.one-item", "zero-items", (expect) => {
  const before = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const after = makeStore({ "p.md": planText("p", { items: I(1), log: passes(["D1"]) }) });
  const b = snapshot(before).tree.root.children[0].cells.get("now");
  const a = snapshot(after).tree.root.children[0].cells.get("now");
  expect("zero.one-item", b.pct === 0 && a.pct === 100, `${b.text} / ${a.text}`);
});

assertion("zero.rate-none", "zero-items", (expect) => {
  // D6's fourth clause: a rate with no baseline and no design change renders `none`. It used to render
  // nothing at all, which is the one outcome the item rules out — a missing number reads as an oversight,
  // and there is no way to tell it apart from a renderer that dropped the field.
  const dir = makeStore({ "empty.md": planText("empty", { items: I(0), baseline: I(0) }) });
  const r = runHtml(dir, "--html", "empty");
  const page = readFileSync(join(dir, "empty.html"), "utf8");
  expect("zero.rate-none", r.code === 0 && page.includes("prediction rate none"), JSON.stringify({ code: r.code, sub: (page.match(/<p class="sub">[^<]*/) ?? [""])[0] }));
  expect("zero.no-nan", !/NaN|Infinity/.test(page), (page.match(/.{0,40}(NaN|Infinity).{0,40}/) ?? [""])[0]);
});

// --- case wbs-vs-edit (D4) --------------------------------------------------

assertion("snapshot.stable", "wbs-vs-edit", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(2), log: passes(["D1"]) }) });
  const s = snapshot(dir);
  expect("snapshot.stable", s.inconsistent === false, "a store nobody touched must not warn");
});

assertion("snapshot.one-edit", "wbs-vs-edit", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(2), log: passes(["D1"]) }) });
  let n = 0;
  const reads = (d) => { if (n++ === 1) writeFileSync(join(d, "p.md"), planText("p", { items: I(2), log: passes(["D1", "D2"]) })); return readStore(d); };
  const s = snapshot(dir, { reads });
  expect("snapshot.one-edit", s.inconsistent === false && s.tree.root.cells.get("now").verified === 2,
    `${s.inconsistent} ${s.tree.root.cells.get("now").text}`);
});

assertion("snapshot.every-read", "wbs-vs-edit", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(2) }) });
  let n = 0;
  const reads = (d) => { writeFileSync(join(d, "p.md"), planText("p", { items: I(2 + (n++ % 3)) })); return readStore(d); };
  const s = snapshot(dir, { reads });
  // the reads write 2, 3 then 4 items, so "renders the last complete read" has an observable answer: 4. The
  // flag alone never said WHICH read was rendered — a snapshot that warned and then rendered the first read
  // would have passed, and that is the one outcome the item rules out.
  expect("snapshot.every-read", s.inconsistent === true && s.tree.root.children.length === 1, String(s.inconsistent));
  expect("snapshot.every-read-renders-the-last", s.tree.root.cells.get("now").total === 4,
    `rendered ${s.tree.root.cells.get("now").text}, the third read had 4 items`);
});

// D4's `same()` compares the `bytes` Map by SIZE and KEYS before it compares any text, so a plan that
// appears, vanishes or is renamed between two reads already changes the key set and is already caught.
// Review 7's F7 read "compares file bytes" as content-only and asked for the rule to be defined; the rule
// was there, but only an edit to an ALREADY-KNOWN file was fixtured — so the property held by accident of
// the data rather than by test. The observable is the file set of the store that was RETURNED: a snapshot
// that failed to notice would hand back the first read, whose key set is the pre-change one.
const raceCase = (id, mutate, wantedFiles) => assertion(id, "wbs-vs-edit", (expect) => {
  const dir = makeStore({ "a.md": planText("a", { items: I(1) }), "b.md": planText("b", { items: I(1) }) });
  let n = 0;
  const reads = (d) => { if (n++ === 1) mutate(d); return readStore(d); };
  const s = snapshot(dir, { reads });
  const got = [...s.store.bytes.keys()].sort().join(",");
  // one change, so D4 recomputes once and the snapshot is consistent — the warning is for a store that is
  // still moving on the third read, which snapshot.race-churn covers
  expect(id, s.inconsistent === false && got === wantedFiles, `inconsistent=${s.inconsistent}, files ${got}, wanted ${wantedFiles}`);
});

raceCase("snapshot.race-create", (d) => writeFileSync(join(d, "c.md"), planText("c", { items: I(1) })), "a.md,b.md,c.md");
raceCase("snapshot.race-delete", (d) => rmSync(join(d, "b.md"), { force: true }), "a.md");
// the sharpest of the three: the text is byte-identical and the slug inside it is unchanged, so the tree
// renders the same two plans either way. Only the file set moved, which is precisely the case a content-only
// comparison would miss
raceCase("snapshot.race-rename", (d) => {
  const t = readFileSync(join(d, "b.md"), "utf8");
  rmSync(join(d, "b.md"), { force: true });
  writeFileSync(join(d, "z.md"), t);
}, "a.md,z.md");

assertion("snapshot.race-churn", "wbs-vs-edit", (expect) => {
  const dir = makeStore({ "a.md": planText("a", { items: I(1) }) });
  let n = 0;
  const reads = (d) => { writeFileSync(join(d, `n${n++}.md`), planText(`n${n}`, { items: I(1) })); return readStore(d); };
  const s = snapshot(dir, { reads });
  expect("snapshot.race-churn", s.inconsistent === true && s.store.bytes.size === 4,
    `inconsistent=${s.inconsistent}, ${s.store.bytes.size} file(s) in the rendered read`);
});

// --- case control-chars (D12) -----------------------------------------------

assertion("control.tree", "control-chars", (expect) => {
  // Only the characters a frontmatter value can actually carry go in the title: CR, LF, LS and PS end a
  // frontmatter line in dod-index.mjs's own parser, so a title holding one is a plan that does not parse,
  // which control.unparseable asserts below rather than leaving to chance. ESC, CSI and NEL do survive the
  // parser, so those are the ones a renderer has to make inert.
  const nasty = ["a", ESC, "[2Kb", NEL, "c", CSI, "d"].join("");
  const dir = makeStore({ "p.md": planText("p", { fm: { title: nasty }, items: I(1) }) });
  const t = snapshot(dir).tree;
  expect("control.title-survives", t.root.children[0].name === nasty, JSON.stringify(t.root.children[0].name));
  for (const [id, out] of [["control.tree", renderTree(t, {})], ["control.compact", renderTree(t, { compact: true })]]) {
    // the payload, not a letter: "node origin baseline now" would match a loose filter and hide a split.
    // D12 is about a SINGLE-LINE record, so the control scan runs per line — the render's own newlines are
    // the separator, not a violation, and testing the whole string would only ever say "contains a newline".
    const lines = out.split(NEWLINE);
    const body = lines.filter((l) => l.includes("[2Kb"));
    expect(id, body.length === 1 && lines.every((l) => !CONTROL_RE.test(l)) && body[0].endsWith("0/1 0 %"),
      `len=${body.length} dirty=${JSON.stringify(lines.filter((l) => CONTROL_RE.test(l)))} end=${JSON.stringify(body[0]?.slice(-10))}`);
  }
  // D12 names five surfaces for this title and only two were checked. wbs.md is a table of single-line
  // records, and the item says the same title reaches both HTML pages ESCAPED rather than stripped — the
  // stated exception, which is only an exception if someone looks.
  const md = exportMd(t).split(NEWLINE);
  const mdBody = md.filter((l) => l.includes("[2Kb"));
  // one row per node per column, which is two here — the claim is that the title cannot SPLIT a row, not that
  // it appears once, and a row count pinned to the column count says so without hiding either
  expect("control.md", mdBody.length === t.columns.length && md.every((l) => !CONTROL_RE.test(l)),
    JSON.stringify(mdBody));
  for (const args of [["--html", "p"], ["--html", "p", "--review"]]) {
    const r = runHtml(dir, ...args);
    const file = join(dir, args.includes("--review") ? "p.review.html" : "p.html");
    const page = readFileSync(file, "utf8");
    // the pages are D12's OTHER stated exception: they escape `& < > " '` rather than deleting anything, so
    // the control characters SURVIVE here while the tree and wbs.md strip them. That is the whole point of
    // writing the exception down, and it is only an exception if something checks that it holds — a page that
    // quietly started stripping would satisfy every other assertion in this fixture.
    expect("control.pages", r.code === 0 && page.includes(nasty) && !/<script|[<>]2Kb/.test(page),
      `${args.join(" ")} -> ${r.code} ${JSON.stringify((page.match(/<title>[^<]*<\/title>/) ?? [""])[0])}`);
  }
  // and the whole store through the real commands, both streams: the tree lines, the status line and the
  // progress lines are scanned together, so a single-line record added later that forgets text1 fails here
  // rather than waiting for someone to name it.
  for (const args of [["--wbs"], ["--export", "csv"], ["--export", "md"]]) {
    const r = runHtml(dir, ...args);
    const dirty = [...r.out, ...r.err].flatMap((s) => s.split(NEWLINE)).filter((l) => CONTROL_RE.test(l));
    expect("control.commands", r.code === 0 && dirty.length === 0, `${args.join(" ")} -> ${JSON.stringify(dirty)}`);
  }
  // the progress line is the one single-line record no fixture could reach with hostile text: it needs a
  // store of eleven plans, and a slug is a FILE NAME, which SLUG_RE does not constrain on the way in — this
  // store has one tame plan and the eleven-plan store has eleven tame ones. An LF there forges a second
  // progress line, so it is asserted at the helper, which is the only place both halves are in reach.
  const forged = progressLine(1, 2, ["p", LF, "plan 2/2 · q"].join(""));
  expect("control.progress-line", forged.split(NEWLINE).length === 1 && !CONTROL_RE.test(forged), JSON.stringify(forged));
});

assertion("control.unparseable", "control-chars", (expect) => {
  // a line terminator inside a frontmatter value is not rendered inert, it is refused: the plan does not
  // parse, and D27's noParse class is what the user sees
  for (const ch of [CR, LF, LS, PS]) {
    const dir = makeStore({ "p.md": planText("p", { fm: { title: ["a", ch, "b"].join("") }, items: I(1) }) });
    const plan = parsePlan(readFileSync(join(dir, "p.md"), "utf8"), join(dir, "p.md"));
    // It still has frontmatter, so it is not skipped as a non-plan: it is a BROKEN plan, which is the
    // noParse class D27 names. The two halves that matter are that the user is TOLD (a parse error) and
    // that the terminator never reaches a rendered value: CR, LS and PS make the frontmatter line match
    // nothing, while LF simply ends it, so the title becomes "a" rather than carrying the break.
    const title = plan.fm.title;
    expect("control.unparseable", plan.parseErrors.length > 0 && (title === undefined || !CONTROL_RE.test(title)),
      `U+${ch.charCodeAt(0).toString(16)}: errors=${plan.parseErrors.length} title=${JSON.stringify(title)}`);
  }
});

// --- fixture export (D7, D8, D9, D11) ---------------------------------------

// A deliberately literal RFC 4180 reader. Using the writer's own escaping to read the file back would
// only prove the writer is self-consistent; this one knows nothing but the standard.
export function parseCsv(text) {
  const rows = [];
  let row = [], cellText = "", quoted = false, i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cellText += '"'; i += 2; continue; }
      if (c === '"') { quoted = false; i++; continue; }
      cellText += c; i++; continue;
    }
    if (c === '"' && cellText === "") { quoted = true; i++; continue; }
    if (c === ",") { row.push(cellText); cellText = ""; i++; continue; }
    if (c === NEWLINE) { row.push(cellText); rows.push(row); row = []; cellText = ""; i++; continue; }
    if (c === CH(0x0d)) { i++; continue; }
    cellText += c; i++;
  }
  if (cellText !== "" || row.length) { row.push(cellText); rows.push(row); }
  return rows;
}

const unprefix = (s) => (s.startsWith("'") ? s.slice(1) : s);

assertion("export.csv-cells", "export", (expect) => {
  // the exact list D7 names, each of which a spreadsheet would otherwise execute or mangle
  const values = ["=cmd()", "+1", "-1", "@here", ['a', CH(0x22), 'b'].join(""), ["a", LF, "b"].join(""), "a|b"];
  const line = values.map(csvCell).join(",");
  const back = parseCsv(line + NEWLINE)[0].map(unprefix);
  expect("export.csv-cells", back.length === values.length && back.every((v, k) => v === values[k]),
    JSON.stringify({ line, back, values }));
  const prefixed = values.slice(0, 4).map(csvCell);
  expect("export.csv-prefixed", prefixed.every((s) => s.startsWith("'") || s.startsWith('"' + "'")),
    JSON.stringify(prefixed));
  // D7 names six leading characters, not four. Tab and CR are the two the strip pass then removes, which is
  // exactly why the prefix is decided on the ORIGINAL first character: decide it after stripping and a cell
  // that began with a tab loses the tab AND the quote, and reaches the spreadsheet bare.
  const ctrlLead = [CH(0x09), CR].map((c) => csvCell(c + "foo"));
  expect("export.csv-prefixed-control-lead", ctrlLead.every((s) => s === "'foo"), JSON.stringify(ctrlLead));
});

assertion("export.csv-strips", "export", (expect) => {
  // the newline and the pipe survive; every other control character does not — the stated exception, and
  // only that exception
  const cell = csvCell(["a", ESC, "[2K", LF, "b", CSI, "|", NEL, "c"].join(""));
  const value = unprefix(parseCsv(cell + NEWLINE)[0][0]);
  expect("export.csv-strips", value === ["a[2K", LF, "b|c"].join("") , JSON.stringify(value));
});

assertion("export.csv-scale", "export", (expect) => {
  const n = 1000;
  const rows = Array.from({ length: n }, (_, k) => [`r${k}`, ["x", LF, "y"].join(""), "=1"].map(csvCell).join(","));
  const text = rows.join(NEWLINE) + NEWLINE;
  const back = parseCsv(text);
  expect("export.csv-scale", back.length === n && back[0][1] === ["x", LF, "y"].join("") && unprefix(back[999][2]) === "=1",
    `${back.length} rows`);
});

assertion("export.empty-store", "export", (expect) => {
  const dir = makeStore({});
  const t = snapshot(dir).tree;
  const csv = exportCsv(t), md = exportMd(t);
  expect("export.empty-csv", csv.split(NEWLINE).filter(Boolean).length === 1, JSON.stringify(csv));
  expect("export.empty-md", md.split(NEWLINE).filter(Boolean).length === 2, JSON.stringify(md));
  expect("export.empty-status", statusLine("export", 0, "header only", 0) === "export: 0 plan(s) · header only",
    statusLine("export", 0, "header only", 0));
  // the three expects above are pure: exportCsv and statusLine were called directly and nothing ran the
  // command or looked on disk. D7's and D8's own `fails when` is "an empty store writes no file at all",
  // which those three cannot see — so run both, read the target back, and require the status line from the
  // run rather than from the helper that builds it.
  const rc = runHtml(dir, "--export", "csv");
  expect("export.empty-csv-on-disk", rc.code === 0 && existsSync(join(dir, "wbs.csv"))
    && readFileSync(join(dir, "wbs.csv"), "utf8") === csv && rc.out[rc.out.length - 1] === "export: 0 plan(s) · header only",
    JSON.stringify({ code: rc.code, last: rc.out[rc.out.length - 1] }));
  const rm = runHtml(dir, "--export", "md");
  expect("export.empty-md-on-disk", rm.code === 0 && existsSync(join(dir, "wbs.md"))
    && readFileSync(join(dir, "wbs.md"), "utf8") === md && rm.out[rm.out.length - 1] === "export: 0 plan(s) · header only",
    JSON.stringify({ code: rm.code, last: rm.out[rm.out.length - 1] }));
});

assertion("export.md-links", "export", (expect) => {
  const hostile = "a](http://x) b";
  const dir = makeStore({ "p.md": planText("p", { fm: { title: hostile }, items: I(1) }) });
  const md = exportMd(snapshot(dir).tree);
  const planRows = md.split(NEWLINE).filter((l) => l.includes("a\\]"));
  expect("export.md-one-link", planRows.length > 0 && planRows.every((l) => (l.match(/\]\(/g) ?? []).length === 1),
    JSON.stringify(planRows[0]));
  expect("export.md-target", planRows[0].includes("(p.md)"), JSON.stringify(planRows[0]));
  expect("export.md-inert", !planRows[0].includes("](http://x)"), JSON.stringify(planRows[0]));
  // D8 says text AND target escape the four characters. Every assertion above is about the text; the target
  // is built from the file name, and a file name is not a slug the grammar constrains — `a)b.md` is a legal
  // file on every platform this runs on, and unescaped it closes the link two characters early.
  const odd = makeStore({ "a)b.md": planText("a)b", { items: I(1) }) });
  const row = exportMd(snapshot(odd).tree).split(NEWLINE).find((l) => l.includes("a\\)b"));
  expect("export.md-target-escaped", Boolean(row) && row.includes("(a\\)b.md)") && (row.match(/\]\(/g) ?? []).length === 1,
    JSON.stringify(row));
  // and one row per node: the store row plus the plan's, which nothing counted
  const all = exportMd(snapshot(odd).tree).split(NEWLINE).filter(Boolean).slice(2);
  expect("export.md-one-row-per-node", all.length === rowsOf(snapshot(odd).tree).length && all.length >= 2,
    `${all.length} row(s)`);
});

assertion("export.md-pipes", "export", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { fm: { title: "a|b|c" }, items: I(1) }) });
  const md = exportMd(snapshot(dir).tree).split(NEWLINE).filter(Boolean);
  const cells = (l) => l.split(/(?<!\\)\|/).length;
  const header = cells(md[0]);
  expect("export.md-pipes", md.slice(2).every((l) => cells(l) === header),
    JSON.stringify(md.slice(2).map(cells)));
});

// --- D9: the three refusal classes, each labelled with the line it must print ------------------------

const refusalOf = (store, target) => {
  try { writeUnderStore(store, target, "x"); return "written"; }
  catch (e) { return e instanceof WbsError ? e.line : `threw ${e.code ?? e.message}`; }
};

assertion("export.refuse-outside", "export", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const above = join(dirname(realpathSync(dir)), "escaped.csv");
  expect("export.refuse-outside", refusalOf(dir, above) === fmt("outside", { path: plainText(above), store: plainText(realpathSync(dir)) }),
    refusalOf(dir, above));
  expect("export.refuse-outside-clean", !existsSync(above), "a refused destination was created");
});

assertion("export.refuse-link-outside", "export", (expect) => {
  // (a), not (b): outside is checked first, so a link POINTING outside reports outside
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const outsideDir = tempDir("dod-wbs-out-");
  const outsideFile = join(outsideDir, "target.csv");
  writeFileSync(outsideFile, "before");
  const linked = join(dir, "wbs.csv");
  try { symlinkSync(outsideFile, linked, "file"); } catch (e) { expect("export.refuse-link-outside", false, `symlink unavailable: ${e.code}`); return; }
  expect("export.refuse-link-outside", refusalOf(dir, linked) === fmt("outside", { path: plainText(linked), store: plainText(realpathSync(dir)) }),
    refusalOf(dir, linked));
  expect("export.refuse-link-outside-clean", readFileSync(outsideFile, "utf8") === "before", "the outside file was written through a link");
});

assertion("export.refuse-junction", "export", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const outsideDir = tempDir("dod-wbs-out-");
  const linkDir = join(dir, "linked");
  try { symlinkSync(outsideDir, linkDir, "junction"); } catch (e) { expect("export.refuse-junction", false, `junction unavailable: ${e.code}`); return; }
  const target = join(linkDir, "wbs.csv");
  expect("export.refuse-junction", refusalOf(dir, target) === fmt("outside", { path: plainText(target), store: plainText(realpathSync(dir)) }),
    refusalOf(dir, target));
  expect("export.refuse-junction-clean", readdirSync(outsideDir).length === 0, "a file landed outside the store");
});

assertion("export.refuse-link-inside", "export", (expect) => {
  // (b): the case that distinguishes link from outside — the link's target is itself under the store
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const inside = join(dir, "real.csv");
  writeFileSync(inside, "before");
  const linked = join(dir, "wbs.csv");
  try { symlinkSync(inside, linked, "file"); } catch (e) { expect("export.refuse-link-inside", false, `symlink unavailable: ${e.code}`); return; }
  expect("export.refuse-link-inside", refusalOf(dir, linked) === fmt("link", { path: plainText(linked) }), refusalOf(dir, linked));
  expect("export.refuse-link-inside-clean", readFileSync(inside, "utf8") === "before", "the link was written through");
});

assertion("export.refuse-plan-files", "export", (expect) => {
  const dir = makeStore({
    "p.md": planText("p", { items: I(1) }),
    "p.reviews.md": "## Review 1 · 2026-09-19 · codex · plan commit abc1234\nF1 blocking: x\n15/15 layers · 49/49 probes\nVERDICT: READY\n### Dispositions\n- F1 · accepted · x\n",
    "README.md": "# index\n",
    "notes.md": "just a note, no frontmatter\n",
  });
  for (const name of ["p.md", "README.md", "p.reviews.md"]) {
    const target = join(dir, name);
    const before = readFileSync(target, "utf8");
    expect("export.refuse-plan-files", refusalOf(dir, target) === fmt("isPlan", { path: plainText(target) }),
      `${name} -> ${refusalOf(dir, target)}`);
    expect("export.refuse-plan-files-intact", readFileSync(target, "utf8") === before, `${name} was modified`);
  }
  // a `.md` that is NOT a plan is an ordinary destination — the rule is "never a plan", not "never .md"
  const ok = join(dir, "notes.md");
  expect("export.allow-non-plan-md", refusalOf(dir, ok) === "written" && readFileSync(ok, "utf8") === "x", refusalOf(dir, ok));
});

// --- D9: the temp file and its sweep ----------------------------------------

assertion("export.temp-sweep", "export", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const mk = (name, ageMs) => { const p = join(dir, name); writeFileSync(p, "stale"); utimesSync(p, new Date(now - ageMs) / 1000, new Date(now - ageMs) / 1000); return p; };
  const stale = mk("wbs-111-aaaaaaaa.tmp", SWEEP_MS + 60_000);
  const fresh = mk("wbs-222-bbbbbbbb.tmp", 60_000);
  // SEVEN hours ahead, not one: a future mtime inside the window is fresh under any age test, so it
  // would not notice `Math.abs(now - mtime) > SWEEP_MS` — the one-line "simplification" that turns a
  // skewed clock into a swept temp file belonging to a live writer
  const future = mk("wbs-333-cccccccc.tmp", -(SWEEP_MS + 60 * 60 * 1000));
  writeUnderStore(dir, join(dir, "wbs.csv"), "x", { now: () => now });
  expect("export.temp-sweep-stale", !existsSync(stale), "a six-hour-old temp file survived");
  expect("export.temp-sweep-fresh", existsSync(fresh), "a one-minute-old temp file was swept");
  expect("export.temp-sweep-future", existsSync(future), "a future mtime was treated as sweepable — clock skew must never sweep a live writer");
  const left = readdirSync(dir).filter((f) => /\.tmp$/.test(f) && !f.includes("222") && !f.includes("333"));
  expect("export.temp-none-left", left.length === 0, JSON.stringify(left));
});

assertion("export.temp-link-refused", "export", (expect) => {
  // A1: O_CREAT|O_EXCL is what carries the no-follow guarantee where O_NOFOLLOW does not exist. A link
  // sitting at a temp path must make the open fail rather than be written through.
  const dir = makeStore({});
  const outside = join(tempDir("dod-wbs-out-"), "victim.txt");
  writeFileSync(outside, "before");
  const tmpPath = join(dir, "wbs-999-dddddddd.tmp");
  try { symlinkSync(outside, tmpPath, "file"); } catch (e) { expect("export.temp-link-refused", false, `symlink unavailable: ${e.code}`); return; }
  let code = "opened";
  try { openSync(tmpPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600); }
  catch (e) { code = e.code; }
  expect("export.temp-link-refused", code === "EEXIST" && readFileSync(outside, "utf8") === "before", `${code}`);
});

assertion("export.identity-check", "export", (expect) => {
  // A1: the identity check must PASS on a host whose lstat reports device 0 — requiring both device and
  // inode everywhere would refuse every write on Windows, which is the bug this case exists to pin
  const dir = makeStore({});
  const p = join(dir, "wbs-000-eeeeeeee.tmp");
  const fd = openSync(p, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  const a = fstatSync(fd), b = lstatSync(p);
  closeSync(fd); unlinkSync(p);
  const devOk = a.dev && b.dev ? a.dev === b.dev : true;
  expect("export.identity-check", a.ino !== 0 && a.ino === b.ino && devOk,
    `fstat ino=${a.ino} dev=${a.dev} / lstat ino=${b.ino} dev=${b.dev}`);
});

assertion("export.race", "export", (expect) => {
  // D10: the only window in which a reader could see half a file is between the temp write and the rename.
  // Writer A is suspended exactly there, writer B runs to completion, and the target is read at every step.
  const dir = makeStore({ "p.md": planText("p", { items: I(2), log: passes(["D1"]) }) });
  const target = join(dir, "wbs.csv");
  const textA = exportCsv(snapshot(dir).tree);
  const textB = textA.replace("baseline", "baseline"); // same shape, distinct object
  const reads = [];
  const readTarget = () => reads.push(existsSync(target) ? readFileSync(target, "utf8") : null);
  readTarget();
  writeUnderStore(dir, target, textA, { beforeRename: () => {
    readTarget();                                   // A's temp exists, nothing published yet
    writeUnderStore(dir, target, textB);            // B publishes while A is suspended
    readTarget();                                   // B's file must be whole
  } });
  readTarget();                                     // A's rename lands last, so A wins
  const complete = (s) => s === null || parseCsv(s).length === countRows(snapshot(dir).tree) + 1;
  // negative control: the oracle has to REJECT a torn file, or "every read was complete" means nothing
  expect("export.race-oracle", !complete(textA.slice(0, Math.floor(textA.length / 2))),
    "the completeness oracle accepts a truncated file — it would pass whatever the writer did");
  expect("export.race-complete", reads.every(complete), JSON.stringify(reads.map((s) => (s === null ? "absent" : parseCsv(s).length))));
  // and the publication must go through a path that is NOT the target, which is what makes it atomic
  expect("export.race-distinct-path", !reads.includes(""), "a zero-length read means the target itself was opened for writing");
  expect("export.race-last-wins", readFileSync(target, "utf8") === textA, "the last rename did not win");
  const left = readdirSync(dir).filter((f) => /\.tmp$/.test(f));
  expect("export.race-no-temp", left.length === 0, JSON.stringify(left));
  // Everything above is observation, and a synchronous test cannot observe tearing: replacing the rename with
  // a plain write to the target passes every read, because no read ever lands mid-write. So assert the
  // property that makes tearing impossible instead — the published file is a DIFFERENT file, not the same one
  // rewritten in place. A rename swaps the directory entry, so the identity changes; an in-place write keeps
  // it, and a reader holding the old handle watches it change under them.
  const beforeIno = statSync(target).ino;
  writeUnderStore(dir, target, textB);
  const afterIno = statSync(target).ino;
  expect("export.race-publication-is-a-rename", beforeIno !== 0 && afterIno !== beforeIno,
    `the target kept file id ${beforeIno} — it was rewritten in place, not replaced`);
});

assertion("export.race-pages", "export", (expect) => {
  // the same guarded helper publishes the two pages, and D10 says they race more often than the exports
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const a = join(dir, "p.html"), b = join(dir, "p.review.html");
  const reads = [];
  writeUnderStore(dir, a, "<h1>page</h1>", { beforeRename: () => {
    writeUnderStore(dir, b, "<h1>review</h1>");
    reads.push(existsSync(a) ? readFileSync(a, "utf8") : null, readFileSync(b, "utf8"));
  } });
  reads.push(readFileSync(a, "utf8"), readFileSync(b, "utf8"));
  expect("export.race-pages", reads.every((s) => s === null || /^<h1>.*<\/h1>$/.test(s)), JSON.stringify(reads));
  expect("export.race-pages-no-temp", readdirSync(dir).filter((f) => /\.tmp$/.test(f)).length === 0, "a temp file survived");
  // D10 names two page races, not one. The pair above writes two DIFFERENT targets, which is the easy half:
  // nothing can tear, because nothing shares a path. Two `--html <slug>` runs race on ONE target, and that is
  // where a torn read and a lost rename are both possible — it had no assertion.
  const same = [];
  const readA = () => same.push(existsSync(a) ? readFileSync(a, "utf8") : null);
  readA();
  writeUnderStore(dir, a, "<h1>first</h1>", { beforeRename: () => {
    readA();                                        // first's temp exists, nothing published yet
    writeUnderStore(dir, a, "<h1>second</h1>");     // second publishes over the same path
    readA();                                        // second's page must be whole
  } });
  readA();                                          // first's rename lands last
  expect("export.race-pages-one-target",
    same.every((s) => s !== null && /^<h1>(page|first|second)<\/h1>$/.test(s)) && same[same.length - 1] === "<h1>first</h1>",
    JSON.stringify(same));
  expect("export.race-pages-one-target-no-temp", readdirSync(dir).filter((f) => /\.tmp$/.test(f)).length === 0, "a temp file survived");
});

assertion("export.swap-race", "export", (expect) => {
  // D9: the target's parent is replaced by a link to an outside directory while the write is in flight.
  // Whatever the ordering, the outside directory must stay empty: either the run refuses with a named
  // class, or it writes inside the store.
  const dir = makeStore({});
  const outsideDir = tempDir("dod-wbs-out-");
  const sub = join(dir, "sub");
  mkdirSync(sub);
  const target = join(sub, "wbs.csv");
  let outcome;
  try {
    writeUnderStore(dir, target, "payload", { beforeRename: () => {
      // swap `sub` for a junction to an outside directory, after the temp file was created inside it
      try { rmSync(sub, { recursive: true, force: true }); symlinkSync(outsideDir, sub, "junction"); } catch { /* held open */ }
    } });
    outcome = "written";
  } catch (e) { outcome = e instanceof WbsError ? e.line : `threw ${e.code ?? e.message}`; }
  const escaped = readdirSync(outsideDir);
  expect("export.swap-race", escaped.length === 0, `the outside directory holds ${JSON.stringify(escaped)} after outcome ${JSON.stringify(outcome)}`);
  const named = outcome === "written" || outcome.startsWith("wbs: ") || outcome.startsWith("threw ");
  expect("export.swap-race-named", named, JSON.stringify(outcome));
});

// --- fixture html (D18, D19) -------------------------------------------------

const COV_ROWS = (rows) => ["| # | Layer | Status | Probes | Pointer / reason |", "|---|---|---|---|---|", ...rows].join("\n");
// a rubric-2 Coverage row whose pointer maps each probe of that layer, with the exceptions a case asks for
const covRow = (n, name, opts = {}) => {
  const ids = Array.from({ length: RUBRIC[2].counts[n - 1] }, (_, i) => `${n}.${i + 1}`);
  const body = ids.filter((p) => p !== opts.unmapped).map((p) => (p === opts.prose ? `${p} prose: the store's own permissions cover this` : `${p} D1`)).join("; ");
  return `| ${n} | ${name} | Considered | ${ids.length}/${ids.length} probes | ${name} › ${body} |`;
};
const runHtml2 = (dir, deps, ...extra) => {
  const out = [], err = [];
  let code, line = null;
  try { code = main(["--dir", dir, ...extra], { log: (s) => out.push(s), error: (s) => err.push(s) }, deps); }
  catch (e) { code = e instanceof WbsError ? e.code : 1; line = e instanceof WbsError ? e.line : String(e?.message ?? e); }
  return { code, out, err, line };
};
const runHtml = (dir, ...extra) => runHtml2(dir, undefined, ...extra);
// the page a case reads is the page the command wrote, never a second render — a renderer that drifts from the
// file it publishes is exactly what this fixture exists to catch
const pageOf = (dir, slug = "full") => readFileSync(join(dir, `${slug}.html`), "utf8");

const FULL = {
  "full.md": planText("full", {
    title: "A plan with every section",
    fm: { rubric: "2", size: "L" },
    items: [{ id: "D1" }, { id: "D2" }, { id: "D3" }],
    amend: "- A1 · 2026-09-19 · discovered · +D3 · layer: 4.2 · package: W1.2 · the second reader had no item\n"
      + "- A2 · 2026-09-19 · requested · ~D2 · layer: — · the owner widened the format list",
    extra: `## Coverage\n${COV_ROWS([covRow(4, "Business rules & invariants", { prose: "4.3", unmapped: "4.5" }), covRow(10, "Security & privacy")])}\n\n`
      + "## Work breakdown\n- W1 · **The parent**\n- W1.1 · **Reading** · items: D1 · steps: 1\n- W1.2 · **Writing** · items: D2 D3 · steps: 2\n\n"
      + "## Build plan\n1. Read the thing · satisfies D1\n2. Write the thing · satisfies D2, D3\n\n",
    log: "- 2026-09-19 · version · v1.0 · the first cut\n" + passes(["D1"]) + "- 2026-09-19 · note · the owner chose the narrow form\n",
  }),
};
// a plan that has none of the optional sections: rubric 1, no packages, no amendments, no versions, no notes
const BARE = { "bare.md": planText("bare", { fm: { rubric: "1" }, items: [], baseline: [] }) };

assertion("html.sections", "html", (expect) => {
  const dir = makeStore(FULL);
  expect("html.exit", runHtml(dir, "--html", "full").code === 0, "the command did not exit 0");
  const page = pageOf(dir);
  const heads = [...page.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
  const want = ["Work breakdown", "Items", "Probe coverage", "Amendments", "Prediction rate", "Log notes"];
  expect("html.every-section-present", want.every((h) => heads.includes(h)) && heads.length === want.length, JSON.stringify(heads));
  // present means populated: not one of them falls back to the absent paragraph on a plan that has them all
  expect("html.none-absent-on-a-full-plan", (page.match(/class="absent"/g) ?? []).length === 0,
    `${(page.match(/class="absent"/g) ?? []).length} section(s) fell back to the absent paragraph on a plan that has them all`);
  // the roll-up is the items' own state: D1 verified of D1 alone, and W1.2's two items unverified
  expect("html.rollup", page.includes("1/1 100 %") && page.includes("0/2 0 %") && page.includes("1/3 33 %"), "package percentages do not match the item states");
  // every probe of every Considered layer, exactly once, with the prose and unmapped answers shown as such
  const probes = [...page.matchAll(/<tr><td class="mono">(\d+\.\d+)/g)].map((m) => m[1]);
  const expected = RUBRIC[2].counts[3] + RUBRIC[2].counts[9];
  expect("html.matrix-every-probe-once", probes.length === expected && new Set(probes).size === expected, `${probes.length} probe row(s), expected ${expected}`);
  expect("html.matrix-prose-and-unmapped", page.includes("prose: the store&#39;s own permissions cover this") && page.includes("not mapped"), "the prose answer or the unmapped probe is not shown");
  // amendments grouped by kind, each with its layer; the trend has a row per declared version
  expect("html.amendments-by-kind", /<h3>discovered · 1<\/h3>/.test(page) && /<h3>requested · 1<\/h3>/.test(page) && page.includes("4.2"), "amendments are not grouped by kind with their layers");
  expect("html.rate-trend", page.includes("baseline") && page.includes("v1.0") && page.includes(">now<"), "the trend has no row per declared version");
  expect("html.log-notes", page.includes("the owner chose the narrow form"), "the Log note is missing");
});

assertion("html.absent-with-a-reason", "html", (expect) => {
  const dir = makeStore(BARE);
  expect("html.bare-exit", runHtml(dir, "--html", "bare").code === 0, "the command did not exit 0");
  const page = pageOf(dir, "bare");
  const blocks = [...page.matchAll(/<h2>([^<]+)<\/h2>\n<p class="absent">([^<]*)<\/p>/g)].map((m) => [m[1], m[2]]);
  expect("html.bare-all-six-absent", blocks.length === 6, `${blocks.length} absent section(s): ${JSON.stringify(blocks.map((b) => b[0]))}`);
  // "absent" is not enough — each one says WHY, in words, so a silently empty section cannot pass as this
  expect("html.bare-each-gives-a-reason", blocks.every(([, why]) => why.trim().length >= 20), JSON.stringify(blocks));
  expect("html.bare-rubric-1-reason", blocks.some(([h, why]) => h === "Probe coverage" && why.includes("rubric 1")), JSON.stringify(blocks));
  expect("html.bare-no-empty-table", !page.includes("<tbody></tbody>") && !page.includes("<ul class=\"tree\"></ul>"), "an empty table or list reached the page");
});

assertion("html.rubric-1-has-no-matrix", "html", (expect) => {
  // the bare plan has no Coverage table at all, so it cannot tell "rubric 1 states no probes" apart from
  // "there was nothing to render" — this one has the table and must still show the reason, not a matrix
  const dir = makeStore({
    "r1.md": planText("r1", {
      fm: { rubric: "1" }, items: [{ id: "D1" }],
      extra: `## Coverage
${COV_ROWS([covRow(4, "Business rules & invariants"), covRow(10, "Security & privacy")])}

`,
    }),
  });
  expect("html.r1-exit", runHtml(dir, "--html", "r1").code === 0, "the command did not exit 0");
  const page = pageOf(dir, "r1");
  expect("html.r1-no-probe-rows", !/<tr><td class="mono">\d+\.\d+/.test(page), "a rubric-1 plan was given a probe matrix");
  const probeSection = (page.split("<h2>Probe coverage</h2>")[1] ?? "").split("<h2>")[0];
  expect("html.r1-reason-names-the-rubric", /<p class="absent">[^<]*rubric 1[^<]*<\/p>/.test(probeSection),
    `the Probe coverage section does not say the rubric is why it is absent: ${probeSection.slice(0, 80)}`);
});

assertion("html.self-contained", "html", (expect) => {
  const dir = makeStore(FULL);
  runHtml(dir, "--html", "full");
  const page = pageOf(dir);
  for (const [what, re] of [["script src", /<script/i], ["link href", /<link\b/i], ["fetch", /fetch\s*\(/], ["src attribute", /\ssrc\s*=/i], ["remote href", /href\s*=\s*"[^"#]/i]]) {
    expect(`html.no-${what.replace(/\s+/g, "-")}`, !re.test(page), `${what} appears in the page`);
  }
  // the store holds the plan and its page and nothing else — no temp file, no second target
  expect("html.writes-one-file", readdirSync(dir).sort().join(",") === "full.html,full.md", readdirSync(dir).join(","));
});

assertion("html.escaping", "html", (expect) => {
  const X = '<script>alert(1)</script>';
  const dir = makeStore({
    "evil.md": planText("evil", {
      title: `${X} "quoted" javascript:alert(2)`,
      fm: { rubric: "2" },
      items: [{ id: "D1", title: "an item", stmt: `a statement carrying ${X} and a " quote` }],
      amend: `- A1 · 2026-09-19 · discovered · ~D1 · layer: 4.2 · package: W1.1 · a why carrying ${X} and javascript:alert(3)`,
      extra: "## Work breakdown\n- W1 · **The parent**\n- W1.1 · **A title with a \" quote** · items: D1 · steps: 1\n\n## Build plan\n1. Do it · satisfies D1\n\n",
    }),
  });
  expect("html.evil-exit", runHtml(dir, "--html", "evil").code === 0, "the command did not exit 0");
  const page = pageOf(dir, "evil");
  expect("html.no-script-tag", !/<script/i.test(page), "an unescaped <script reached the page");
  // every one of the four plan strings arrives as text, escaped, rather than being dropped
  expect("html.escaped-text", (page.match(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/g) ?? []).length >= 3,
    `${(page.match(/&lt;script&gt;/g) ?? []).length} escaped occurrence(s) — title, item statement and amendment why must each survive`);
  expect("html.escaped-quote", page.includes("&quot;") || page.includes("&#39;"), "a quote from plan text is not escaped");
  expect("html.javascript-url-is-text", !/href\s*=\s*"javascript:/i.test(page) && page.includes("javascript:alert(2)"), "a javascript: URL became a link, or was dropped");
  // the negative control: a page built from a renderer that did NOT escape would fail the assertions above,
  // so the fixture proves the escape rather than the absence of the string
  expect("html.control-unescaped-would-fail", /<script/i.test(`<h1>${X}</h1>`), "the control is wrong — the raw string must contain <script");
});

assertion("html.failures", "html", (expect) => {
  const dir = makeStore(FULL);
  const missing = runHtml(dir, "--html", "nosuch");
  expect("html.no-plan", missing.code === 1 && missing.line === fmt("noPlan", { slug: "nosuch", dir }), missing.line ?? "");
  writeFileSync(join(dir, "broken.md"), "no frontmatter here\n");
  const broken = runHtml(dir, "--html", "broken");
  expect("html.no-parse", broken.code === 1 && broken.line === fmt("noParse", { slug: "broken" }), broken.line ?? "");
  // --review writes its own target and never over the plan page
  runHtml(dir, "--html", "full");
  const review = runHtml(dir, "--html", "full", "--review");
  expect("html.review-own-target", review.code === 0 && existsSync(join(dir, "full.review.html"))
    && readFileSync(join(dir, "full.html"), "utf8") !== readFileSync(join(dir, "full.review.html"), "utf8"), review.line ?? "");
});

// --- fixture review-page (D21, D22) ------------------------------------------
//
// A note on D22's word list: it is asserted over these fixtures, which do not quote it. A plan whose own prose
// discusses redaction — this child's plan is one — puts those words on its page as its own text. That is not a
// leak of the author's score: what D22 protects is the Coverage Status column, the probe counts, the two
// coverage_ fields, the gate line and the verdict, none of which this renderer ever emits.

const REDACTED = ["Considered", "Gap", "N/A", "coverage_author", "coverage_reviewer", "Gate —", "VERDICT"];
const probeIdsIn = (page) => [...page.matchAll(/<td class="mono">(\d+\.\d+)/g)].map((m) => m[1]);
const allProbes = (r) => RUBRIC[r].counts.flatMap((c, i) => Array.from({ length: c }, (_, k) => `${i + 1}.${k + 1}`));

// a Coverage table for a review-page fixture: every layer Considered and every probe mapped, minus the
// exceptions a case asks for, plus any layer a case wants declared not applicable
const revCov = (r, o = {}) => COV_ROWS(RUBRIC[r].counts.map((count, i) => {
  const n = i + 1, name = `Layer ${n}`;
  if (o.na === n) return `| ${n} | ${name} | N/A |  | ${o.naTest ?? "nothing here touches it"} |`;
  const ids = Array.from({ length: count }, (_, k) => `${n}.${k + 1}`);
  const body = ids.filter((p) => p !== o.unanswered).map((p) => (p === o.prose ? `${p} prose: the store's own permissions cover it`
    : p === o.empty ? `${p} see the section above` : `${p} D1`)).join("; ");
  return `| ${n} | ${name} | Considered | ${count}/${count} probes | ${o.heading ?? "Business rules"} › ${body} |`;
}));
const revPlan = (slug, r, o = {}) => planText(slug, {
  fm: { rubric: String(r), size: o.size ?? "M" }, items: [{ id: "D1" }],
  children: o.children,
  extra: `## Business rules\n1. The first rule of this plan.\n2. The second rule of this plan.\n\n## Coverage\n${revCov(r, o)}\n\n`,
});
const reviewPage = (files, slug) => { const dir = makeStore(files); const r = runHtml(dir, "--html", slug, "--review"); return { r, page: r.code === 0 ? readFileSync(join(dir, `${slug}.review.html`), "utf8") : "" }; };

assertion("review.every-probe-once", "review-page", (expect) => {
  for (const [slug, rubric, o] of [["r2", 2, {}], ["r1", 1, {}], ["ep", 2, { size: "Epic", children: "- kid · planned", heading: "Children" }]]) {
    const { r, page } = reviewPage({ [`${slug}.md`]: revPlan(slug, rubric, o) }, slug);
    expect(`review.${slug}-exit`, r.code === 0, r.line ?? "");
    const ids = probeIdsIn(page), want = allProbes(rubric);
    expect(`review.${slug}-every-probe-once`, ids.length === want.length && new Set(ids).size === want.length && want.every((p) => ids.includes(p)),
      `${ids.length} row(s) for rubric ${rubric}, expected ${want.length}; missing ${want.filter((p) => !ids.includes(p)).slice(0, 4).join(" ")}`);
    expect(`review.${slug}-probe-text-from-layers`, page.includes("Invariants that must never be violated"), "probe text is not the text layers.md carries");
  }
});

assertion("review.no-answer", "review-page", (expect) => {
  const { page } = reviewPage({ "r2.md": revPlan("r2", 2, { unanswered: "4.5" }) }, "r2");
  expect("review.no-answer-count", (page.match(/no answer/g) ?? []).length === 1, `${(page.match(/no answer/g) ?? []).length} probe(s) flagged, expected exactly 1`);
  // and it is 4.5 that carries it, not some other probe that happens to be unmapped
  const row = page.split('<td class="mono">4.5').slice(1).join("").split("</tr>")[0];
  expect("review.no-answer-is-4-5", row.includes("no answer"), row.slice(0, 120));
});

assertion("review.entry-naming-nothing", "review-page", (expect) => {
  // a pointer entry that names neither an item nor a prose reason has answered nothing, and saying so is the
  // whole point of the page: it must read `no answer`, not an empty cell a reviewer skims past
  const { page } = reviewPage({ "r2.md": revPlan("r2", 2, { empty: "4.2" }) }, "r2");
  const row = page.split('<td class="mono">4.2').slice(1).join("").split("</tr>")[0];
  expect("review.entry-naming-nothing", row.includes("no answer"), row.slice(0, 140));
  expect("review.entry-naming-nothing-only-once", (page.match(/no answer/g) ?? []).length === 1, `${(page.match(/no answer/g) ?? []).length} flagged`);
});

assertion("review.prose-answer", "review-page", (expect) => {
  const { page } = reviewPage({ "r2.md": revPlan("r2", 2, { prose: "4.3" }) }, "r2");
  expect("review.prose-shown", page.includes("the store&#39;s own permissions cover it"), "the prose reason is not shown");
  expect("review.prose-not-flagged", !page.includes("no answer"), "a probe answered by prose was flagged unanswered");
  // the plan's own numbered sentences are on the page — that is what the reviewer judges
  expect("review.numbered-sentences", page.includes("The first rule of this plan.") && page.includes("The second rule of this plan."), "the section's numbered sentences are missing");
});

assertion("review.not-applicable", "review-page", (expect) => {
  const { page } = reviewPage({ "na.md": revPlan("na", 2, { na: 6, naTest: "the script imports no third-party module" }) }, "na");
  expect("review.na-test-shown", page.includes("declared not applicable") && page.includes("the script imports no third-party module"),
    "the applicability test is not on the page");
  const naRows = page.split('<h2 id="L6">').slice(1).join("").split("<h2")[0];
  const want = RUBRIC[2].counts[5];
  // count the probe cells only — the layer's own "declared not applicable" line is not one of its probes
  const flagged = (naRows.match(/class="open">not applicable</g) ?? []).length;
  expect("review.na-probes-flagged", flagged === want, `${flagged} of ${want} probes of layer 6 read not applicable`);
  expect("review.na-not-blank", probeIdsIn(naRows).length === want, "an N/A layer rendered blank rather than listing its probes");
  // and each of those probes still says what it asks: the applicability claim is judged against the probes,
  // so a row with an id and no question is not a rendering of the layer
  expect("review.na-probe-text", naRows.includes("Every external API, service, package, or vendor it depends on"),
    "an N/A layer's probes carry no text from layers.md");
  // every probe id still appears exactly once across the page, N/A layer included
  const ids = probeIdsIn(page);
  expect("review.na-still-complete", ids.length === allProbes(2).length && new Set(ids).size === ids.length, `${ids.length} probe row(s)`);
});

assertion("review.status-token-stripped", "review-page", (expect) => {
  const { page } = reviewPage({ "na.md": revPlan("na", 2, { na: 6, naTest: "N/A — the feature has no external dependency" }) }, "na");
  expect("review.token-stripped", page.includes("the feature has no external dependency"), "the applicability test was lost with its token");
  expect("review.token-not-smuggled", !page.includes("N/A"), "the leading Status token reached a page D22 forbids it from");
  expect("review.token-keeps-the-claim", page.includes("declared not applicable — the feature has no external dependency"),
    "the test is not rendered verbatim after the token");
});

assertion("review.redacted", "review-page", (expect) => {
  const cases = [["r2", revPlan("r2", 2, {})], ["r1", revPlan("r1", 1, {})],
    ["ep", revPlan("ep", 2, { size: "Epic", children: "- kid · planned", heading: "Children" })],
    ["na", revPlan("na", 2, { na: 6, naTest: "nothing here reaches a third party" })]];
  for (const [slug, text] of cases) {
    const { page } = reviewPage({ [`${slug}.md`]: text }, slug);
    for (const w of REDACTED) expect(`review.${slug}-no-${w.replace(/\W/g, "")}`, !page.includes(w), `"${w}" reached the ${slug} page`);
    expect(`review.${slug}-no-probe-count`, !/\d+\/\d+ probes/.test(page), "a probe count reached the page");
  }
  // the N/A layer's own claim survives the redaction that removes the word
  const { page } = reviewPage({ "na.md": revPlan("na", 2, { na: 6, naTest: "nothing here reaches a third party" }) }, "na");
  expect("review.na-claim-survives", page.includes("declared not applicable") && page.includes("nothing here reaches a third party"),
    "the applicability test was redacted along with the word");
});

assertion("review.self-contained", "review-page", (expect) => {
  const { page } = reviewPage({ "r2.md": revPlan("r2", 2, {}) }, "r2");
  for (const [what, re] of [["script", /<script/i], ["link", /<link\b/i], ["fetch", /fetch\s*\(/], ["src", /\ssrc\s*=/i], ["remote href", /href\s*=\s*"[^"#]/i]]) {
    expect(`review.no-${what.replace(/\s+/g, "-")}`, !re.test(page), `${what} appears in the review page`);
  }
  // D19 holds for this page too: plan text is escaped at the one place the surface is built
  const { page: evil } = reviewPage({ "ev.md": planText("ev", {
    title: "<script>alert(1)</script>", fm: { rubric: "2" },
    items: [{ id: "D1", stmt: 'a statement with <script>alert(1)</script> and a " quote' }],
    extra: "## Business rules\n1. A rule naming <script>alert(1)</script>.\n\n## Coverage\n" + revCov(2, {}) + "\n\n",
  }) }, "ev");
  expect("review.escaped", !/<script/i.test(evil) && (evil.match(/&lt;script&gt;/g) ?? []).length >= 3,
    `${(evil.match(/&lt;script&gt;/g) ?? []).length} escaped occurrence(s)`);
});

// --- case failure-classes (D27) ----------------------------------------------

assertion("failure.classes", "failure-classes", (expect) => {
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }), "p.reviews.md": "## Review 1\n" });
  // one line, the stated status, nothing on stdout, no stack trace. The usage block is the one class that is
  // several lines by design, so it is exempted by name rather than by loosening the rule for every class.
  const one = (r, line, code, multi = false) => r.code === code && r.line === line && r.out.length === 0
    && (multi || !/\n/.test(r.line ?? "")) && !/\n\s+at\s/.test(r.line ?? "");
  const cases = [
    ["no store", runHtml(join(dir, "nope"), "--wbs"), fmt("noStore", { dir: join(dir, "nope") }), 1],
    ["unknown slug", runHtml(dir, "--html", "missing"), fmt("noPlan", { slug: "missing", dir }), 1],
    ["bad slug", runHtml(dir, "--html", "Not A Slug"), fmt("badSlug", { slug: "Not A Slug" }), 1],
    ["out too long", runHtml(dir, "--export", "csv", "--out", "x".repeat(OUT_MAX + 1)), fmt("outTooLong"), 1],
    ["usage", runHtml(dir, "--wbs", "--export", "csv"), USAGE, 1, true],
  ];
  for (const [what, r, line, code, multi] of cases) expect(`failure.${what.replace(/\s+/g, "-")}`, one(r, line, code, multi), `${r.code} · ${JSON.stringify(r.line)} · want ${JSON.stringify(line)} · out ${JSON.stringify(r.out)}`);
  // a file with frontmatter that still does not parse is noParse, not a skip
  writeFileSync(join(dir, "broken.md"), "---\nnot: closed\n");
  expect("failure.no-parse", one(runHtml(dir, "--html", "broken"), fmt("noParse", { slug: "broken" }), 1), JSON.stringify(runHtml(dir, "--html", "broken")));
  // a destination that is a plan, a reviews file or the index is refused before anything is written
  for (const [what, name] of [["plan", "p.md"], ["reviews", "p.reviews.md"], ["index", "README.md"]]) {
    const r = runHtml(dir, "--export", "csv", "--out", join(dir, name));
    expect(`failure.dest-${what}`, one(r, fmt("isPlan", { path: join(dir, name) }), 1) && !existsSync(join(dir, "wbs.csv")),
      `${r.code} · ${JSON.stringify(r.line)}`);
  }
  // an unreadable plan: a directory named like one, so the read fails on every platform without touching
  // permissions. The code is whatever this platform reports, read here rather than assumed.
  mkdirSync(join(dir, "adir.md"));
  let ecode = "";
  try { readFileSync(join(dir, "adir.md"), "utf8"); } catch (e) { ecode = e.code ?? "EIO"; }
  expect("failure.unreadable", one(runHtml(dir, "--wbs"), fmt("unreadable", { file: "adir.md", code: ecode }), 1),
    `${JSON.stringify(runHtml(dir, "--wbs").line)} · code ${ecode}`);
  rmSync(join(dir, "adir.md"), { recursive: true, force: true });
  // a destination D9 refuses is a failure class of its own, with the same one-line shape
  const above = join(dir, "..", "escaped-classes.csv");
  const r9 = runHtml(dir, "--export", "csv", "--out", above);
  expect("failure.dest-outside", one(r9, fmt("outside", { path: plainText(above), store: plainText(realpathSync(dir)) }), 1) && !existsSync(above),
    `${r9.code} · ${JSON.stringify(r9.line)}`);
  // the one class that is not an error: the snapshot warns on stderr, exits 0, and still renders
  let n = 0;
  const drifting = (d) => { const s = readStore(d); s.bytes.set([...s.bytes.keys()][0], `changed ${n++}`); return s; };
  const inc = runHtml2(dir, { reads: drifting }, "--wbs");
  expect("failure.inconsistent", inc.code === 0 && inc.err.includes(fmt("inconsistent")) && inc.out.join("").length > 0,
    `${inc.code} · err ${JSON.stringify(inc.err)} · out ${inc.out.length} line(s)`);
  expect("failure.inconsistent-not-on-stdout", !inc.out.join("\n").includes(fmt("inconsistent")), "the warning went to stdout");
  // D4 says the warning stands ABOVE the tree. It goes to stderr, so "above" is an ordering claim across two
  // streams rather than a position within one: it has to be emitted before the first tree line, or a reader
  // watching a terminal gets the numbers first and the doubt about them second.
  const seq = [];
  let m = 0;
  const drifting2 = (d) => { const s = readStore(d); s.bytes.set([...s.bytes.keys()][0], `drifted ${m++}`); return s; };
  main(["--dir", dir, "--wbs"], { log: (s) => seq.push(["out", s]), error: (s) => seq.push(["err", s]) }, { reads: drifting2 });
  const warnAt = seq.findIndex(([, s]) => s === fmt("inconsistent"));
  const firstOut = seq.findIndex(([k]) => k === "out");
  expect("failure.inconsistent-above-the-tree", warnAt >= 0 && firstOut >= 0 && warnAt < firstOut,
    JSON.stringify(seq.slice(0, 3)));
  // every class above printed one line and nothing else; none of them wrote a file
  expect("failure.nothing-written", readdirSync(dir).sort().join(",") === "broken.md,p.md,p.reviews.md", readdirSync(dir).join(","));
});

// --- case import-scan (D26) --------------------------------------------------
//
// The scan reads this file's own source, so it has to look at code rather than at text: every mention below
// appears in a comment or a string somewhere above. `stripLiterals` removes comments, strings, template
// literals and regex literals first, and the case plants a violation in each to prove the stripper is not
// simply deleting the evidence.

const REGEX_AFTER = new Set(["return", "typeof", "instanceof", "in", "of", "case", "delete", "void", "throw", "new", "do", "else", "yield", "await"]);

export function stripLiterals(src) {
  let out = "", i = 0;
  const prev = () => { for (let k = out.length - 1; k >= 0; k--) if (!/\s/.test(out[k])) return out[k]; return ""; };
  const prevWord = () => (/[A-Za-z_$][\w$]*$/.exec(out.replace(/\s+$/, "")) ?? [""])[0];
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      i++; out += q + q; continue;
    }
    // a `/` starts a regex only where a value cannot precede it — after an operator, a comma or an opener,
    // or after one of the keywords that can be followed by an expression. Missing `return /re/` is not a
    // cosmetic slip: the stripper then reads the regex as a division and the next quote as a string opener,
    // and every scan below runs on text that is out of step from there to the end of the file.
    if (c === "/" && (/^$|[(,=:[!&|?{};+\-*%<>~^]/.test(prev()) || REGEX_AFTER.has(prevWord()))) {
      i++;
      let cls = false;
      while (i < src.length && (cls || src[i] !== "/")) {
        if (src[i] === "\\") i++;
        else if (src[i] === "[") cls = true;
        else if (src[i] === "]") cls = false;
        else if (src[i] === "\n") break;
        i++;
      }
      i++; while (i < src.length && /[gimsuyd]/.test(src[i])) i++;
      out += "RE"; continue;
    }
    out += c; i++;
  }
  return out;
}

assertion("import.scan", "import-scan", (expect) => {
  const src = readFileSync(SELF, "utf8");
  const code = stripLiterals(src);
  // the stripper is proved before it is trusted: a violation planted in each kind of literal must vanish, and
  // the same violation planted in code must survive
  // each plant sits after an identifier, where a `/` cannot begin a regex: a comment plant at the start of a
  // line is swallowed by the regex branch either way, so it would pass even with the comment branches removed
  const planted = stripLiterals([
    "id0 // spawn(x) in a line comment", "id1 /* spawn(x) in a block comment */", 'const a = "spawn(x)";',
    "const b = `spawn(x)`;", "const c = /spawn\\(x\\)/;", "spawn(real);",
  ].join("\n"));
  expect("import.stripper-removes-literals", (planted.match(/spawn\(/g) ?? []).length === 1, `${(planted.match(/spawn\(/g) ?? []).length} survived, expected exactly the one in code`);
  expect("import.stripper-keeps-code", planted.includes("spawn(real)"), "the stripper removed code as well as literals");
  // A stripper that loses its place reads code as string and string as code from there to the end of the file,
  // and every scan below then passes on text that is not this file. Two checks catch that: `return /re/` in
  // isolation, and the whole file staying line-for-line in step — a literal never spans a line here.
  expect("import.stripper-regex-after-keyword", !stripLiterals('return /[",x]/.test(b) ? "y" : z;').includes("x"),
    JSON.stringify(stripLiterals('return /[",x]/.test(b) ? "y" : z;')));
  // (a template literal may legitimately span lines, so line counts are not the invariant — the declarations
  // are: every top-level export must still be there, in the order the source declares it)
  const decls = [...src.matchAll(/^export (?:function|const|class) (\w+)/gm)].map((mm) => mm[1]);
  let at = -1;
  const lost = decls.filter((d) => {
    const j = code.search(new RegExp(`^export (?:function|const|class) ${d}\\b`, "m"));
    if (j < 0 || j < at) return true;
    at = j; return false;
  });
  expect("import.stripper-stays-in-step", decls.length > 20 && lost.length === 0, `${decls.length} export(s), lost or reordered: ${lost.join(" ")}`);

  for (const mod of ["http", "https", "net", "dns", "tls", "undici", "child_process", "worker_threads"]) {
    // the import specifier is a string, so it is gone from `code` — the check is on the source, bounded to
    // an import or require of exactly that module
    const re = new RegExp(`(?:from|import|require\\()\\s*["'](?:node:)?${mod}["']`);
    expect(`import.no-${mod}`, !re.test(src), `${mod} is imported`);
  }
  expect("import.no-fetch", !/\bfetch\s*\(/.test(code), "a fetch call is in the code");
  // `exec` is bounded to a bare call: `RE.exec(s)` is a regex match, not a process, and the child_process
  // module it would have to come from is refused by name above
  expect("import.no-process-start", !/\b(?:spawn|spawnSync|execSync|execFile|execFileSync|fork)\s*\(|(?<![.\w])exec\s*\(/.test(code), "a process is started");
  // exactly one environment read, and it is the named constant
  // D26 names the variable, not a number of reads: every read must go through the one named constant
  const envs = [...code.matchAll(/process\.env\s*(\[[^\]]*\]|\.\w+)/g)].map((m) => m[1]);
  expect("import.only-the-named-env", envs.length > 0 && envs.every((e) => e.includes("ENV_READ")), JSON.stringify(envs));
  expect("import.env-constant-is-the-named-one", ENV_READ === "DOD_SELFTEST_TIMING", ENV_READ);
  // no home-directory or credential path literal, anywhere — these live in strings, so the source is scanned
  // each needle is spelled in halves, so this list is not itself the match the scan then reports
  for (const [x, y] of [["~", "/"], ["%APP", "DATA%"], [".", "ssh"], [".", "aws"], ["id_", "rsa"]]) {
    const bad = x + y;
    expect(`import.no-path-${bad.replace(/\W/g, "")}`, !src.includes(`"${bad}`) && !src.includes(`'${bad}`) && !src.includes("`" + bad), `${bad} appears as a path literal`);
  }
  // every write goes through the one guarded helper (D9), so a direct write cannot slip past the refusals
  const WRITE = /\b(?:writeFileSync|appendFileSync|renameSync|openSync|writeSync|symlinkSync|mkdirSync)\s*\(/g;
  const testsFrom = code.indexOf("export const ASSERTIONS");
  const testsTo = code.indexOf("const invoked =");
  const guardFrom = code.indexOf("export function writeUnderStore");
  const guardTo = code.indexOf("export function csvCell");
  // the entry block must really fall on the far side of testsTo, or the two region checks below are scanning
  // a region that happens to be empty and would pass however the code moved
  expect("import.scan-anchors-found", testsFrom > 0 && guardFrom > 0 && guardTo > guardFrom && testsTo > testsFrom
    && code.slice(testsTo).includes("console"), `${testsFrom} ${testsTo} ${guardFrom} ${guardTo} ${code.length}`);
  // what ships is everything outside the fixture registry: before it, plus the entry block that follows it.
  // The fixtures in between build temp stores, which is test code and never touches a real store.
  const ships = (m) => m.index < testsFrom || m.index >= testsTo;
  const stray = [...code.matchAll(WRITE)].filter(ships).filter((m) => !(m.index >= guardFrom && m.index < guardTo));
  expect("import.writes-are-guarded", stray.length === 0, `${stray.length} write call(s) outside writeUnderStore: ${stray.map((m) => m[0].trim()).join(" ")}`);
  // Every line a command prints goes through the injected `io` sinks, which is what lets a fixture capture it;
  // a direct console call would print for real and stay invisible to every failure-class case. The entry block
  // after the fixtures is the one place that touches the console, because it is what supplies those sinks.
  const shouts = [...code.matchAll(/\bconsole\s*\.\s*\w+|process\s*\.\s*std(?:out|err)\s*\.\s*write/g)].filter((m) => m.index < testsFrom);
  expect("import.output-goes-through-io", shouts.length === 0, `${shouts.length} direct console call(s): ${shouts.map((m) => m[0]).join(" ")}`);
  // D26 also bounds where it READS: every read takes a path derived from the store argument, never a literal
  // (a literal survives the stripper as an empty pair of quotes), and exactly one path is module-relative —
  // LAYERS_MD, which is the `references/` read the item names.
  // A3 widened this from the production region to the WHOLE file: the fixtures read too, and the claim is
  // about what the script reads, not about what one half of it reads
  const literalReads = [...code.matchAll(/\b(?:readFileSync|readdirSync|statSync|lstatSync|openSync)\s*\(\s*(""|''|``)/g)];
  expect("import.no-literal-read", literalReads.length === 0, `${literalReads.length} read(s) of a hard-coded path`);
  const selfRel = [...code.matchAll(/fileURLToPath\s*\(\s*import\.meta\.url\s*\)/g)];
  expect("import.one-module-relative-path", selfRel.length === 1, `${selfRel.length} module-relative path(s), expected only SELF`);
  // and the roots that one is unrolled into are the three the item now names, all of which exist
  expect("import.the-three-roots", SELF.endsWith("dod-wbs.mjs") && REF_DIR === join(SKILL_DIR, "references")
    && LAYERS_MD === join(REF_DIR, "layers.md") && [SELF, LAYERS_MD, join(SKILL_DIR, "SKILL.md")].every((f) => existsSync(f)),
    `${SELF} | ${LAYERS_MD} | ${join(SKILL_DIR, "SKILL.md")}`);
});

// --- case docs-sync (D23) ----------------------------------------------------
//
// Three sentences have to stay in three documents. Each is asserted present AND asserted to be the reason the
// case passes: with that one sentence deleted, the same check must fail. A document that keeps the command
// but loses the ordering word, or loses the question-batch sentence while the command survives somewhere
// else in the file, is exactly the drift this catches.

export const DOCS_SENTENCES = [
  {
    id: "review.md-before",
    file: () => join(REF_DIR, "review.md"),
    what: "the author generates the review page BEFORE asking a human",
    find: (t) => sentences(t).filter((s) => s.includes("--html <slug> --review") && /\b(before|first|then)\b/i.test(s)),
  },
  {
    id: "review.md-names-the-path",
    file: () => join(REF_DIR, "review.md"),
    what: "the request names the page's path",
    find: (t) => sentences(t).filter((s) => s.includes(".review.html") && /\bname[sd]?\b/i.test(s)),
  },
  {
    id: "SKILL.md-question-batch",
    file: () => join(SKILL_DIR, "SKILL.md"),
    what: "a question batch about a plan carries that path beside the questions",
    find: (t) => sentences(t).filter((s) => s.includes(".review.html") && /\bbatch\b/i.test(s) && /\bbeside\b/i.test(s)),
  },
];

// a sentence ends at a full stop that is not inside a path or an ellipsis; paragraphs are joined first so a
// wrapped sentence is one string, which is how these documents are actually written
export function sentences(text) {
  return text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " "))
    .flatMap((p) => p.split(/(?<=[.!?])\s+(?=[A-Z`*[])/))
    .map((s) => s.trim()).filter(Boolean);
}

assertion("docs.sync", "docs-sync", (expect) => {
  for (const s of DOCS_SENTENCES) {
    const file = s.file();
    expect(`docs.${s.id}-file-exists`, existsSync(file), file);
    if (!existsSync(file)) continue;
    // the search and the deletion both work on the joined text: a sentence wrapped across source lines is one
    // string there and is not a substring of the raw file, so deleting from the raw file would delete nothing
    // and the load-bearing check would pass without proving anything
    const text = sentences(readFileSync(file, "utf8")).join(" ");
    const hits = s.find(text);
    expect(`docs.${s.id}`, hits.length >= 1, `no sentence in ${basename(file)} says: ${s.what}`);
    if (hits.length === 0) continue;
    // the sentence is load-bearing: delete it and the same search must come up empty. Without this, a check
    // that matched on something incidental elsewhere in the file would pass forever.
    const without = text.split(hits[0]).join("");
    expect(`docs.${s.id}-load-bearing`, s.find(without).length === 0,
      `${basename(file)} still matches with the sentence removed — the check is matching something else`);
  }
});

// --- case messages-match-table (D24) -----------------------------------------
//
// Each script checks only its own rows, so neither imports the other and `npm run validate` keeps working on
// a machine that has never installed scripts/checks/.

export const WBS_MD = join(REF_DIR, "wbs.md");

// | Script | Message | Exit | What you do next |
export function tableRows(text) {
  const out = [];
  for (const line of text.split(NEWLINE)) {
    const m = /^\|\s*`([^`]+)`\s*\|\s*`(.+?)`\s*\|\s*(\d)\s*\|/.exec(line.trim());
    if (m) out.push({ script: m[1], message: m[2], exit: Number(m[3]) });
  }
  return out;
}

assertion("messages.match-table", "messages-match-table", (expect) => {
  expect("messages.table-exists", existsSync(WBS_MD), WBS_MD);
  if (!existsSync(WBS_MD)) return;
  const text = readFileSync(WBS_MD, "utf8");
  const rows = tableRows(text);
  expect("messages.table-has-rows", rows.length > 10, `${rows.length} row(s)`);

  // every row names a script the document's own header lists — which is how a row no script owns fails
  // without either script importing the other
  // to the end of the line, not to the first full stop: every script name here contains one
  const named = [...(/The scripts named in this table are ([^\n]+)/.exec(text)?.[1] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  expect("messages.header-names-the-scripts", named.includes("dod-wbs.mjs") && named.length >= 2, JSON.stringify(named));
  const orphans = rows.filter((r) => !named.includes(r.script));
  expect("messages.no-orphan-rows", orphans.length === 0, `row(s) naming ${[...new Set(orphans.map((r) => r.script))].join(", ")}`);

  // this script's own half, in both directions. The usage block is the one documented exemption: it is
  // several lines by design, so the table cites its first line.
  const mine = rows.filter((r) => r.script === "dod-wbs.mjs").map((r) => r.message);
  const usageFirst = USAGE.split(NEWLINE)[0];
  expect("messages.usage-row-is-the-first-line", mine.includes(usageFirst), usageFirst);
  expect("messages.exemption-is-stated", /usage block .* first line/s.test(text), "wbs.md does not state the usage exemption");
  const mineNoUsage = mine.filter((m) => m !== usageFirst).sort();
  const ours = Object.values(MESSAGES).sort();
  const missing = ours.filter((m) => !mineNoUsage.includes(m));
  const extra = mineNoUsage.filter((m) => !ours.includes(m));
  expect("messages.every-message-has-a-row", missing.length === 0, `${missing.length} missing: ${missing.join(" | ").slice(0, 120)}`);
  expect("messages.every-row-has-a-message", extra.length === 0, `${extra.length} unmatched: ${extra.join(" | ").slice(0, 120)}`);

  // the exit status the table states is the one the class carries: 0 for the inconsistent snapshot, 1 for
  // every other dod-wbs.mjs row
  const badExit = rows.filter((r) => r.script === "dod-wbs.mjs")
    .filter((r) => r.exit !== (r.message === MESSAGES.inconsistent ? 0 : 1));
  expect("messages.exit-status-matches", badExit.length === 0, badExit.map((r) => `${r.message} -> ${r.exit}`).join(" | "));
});

// --- fixture scale (D13) -----------------------------------------------------

export const TIMING = { plans1000: 5000, plans100: 2000 };

// D13's stores are built once and reused by both assertions: generating a thousand plan files twice would
// measure the generator, not the render.
function scaleStore(n, items, depth) {
  const files = {};
  for (let k = 0; k < n; k++) {
    const level = k === 0 ? 0 : (k % depth) || 0;
    const parent = k === 0 || level === 0 ? undefined : `s${k - 1}`;
    files[`s${k}.md`] = planText(`s${k}`, { items: I(items), ...(parent ? { fm: { parent } } : {}) });
  }
  return makeStore(files);
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const timeRender = (dir) => { const t0 = process.hrtime.bigint(); const s = snapshot(dir); renderTree(s.tree); return Number(process.hrtime.bigint() - t0) / 1e6; };

assertion("scale.parse-count", "scale", (expect) => {
  const dir = scaleStore(1000, 30, 5);
  const store = readStore(dir);
  // the counter is the claim: one read per file, so a second pass over the same file fails here rather than
  // quietly doubling the work on a real store
  expect("scale.one-read-per-file", store.reads === 1000 && store.plans.length === 1000,
    `${store.reads} read(s) for ${store.plans.length} plan(s)`);
  const t = timeRender(dir);
  const assertTimings = process.env[ENV_READ] === "assert";
  // printed always, asserted only under the environment variable — a slow machine must not turn a correct
  // render into a failure, and a fast one must not hide a regression from anyone who asks for the check
  ASSERTIONS.get("scale.parse-count").timing = `1000 plans x 30 items: ${Math.round(t)} ms on ${process.platform} node ${process.versions.node}`;
  if (assertTimings) {
    const runs = [timeRender(dir), timeRender(dir), timeRender(dir), timeRender(dir), timeRender(dir)];
    expect("scale.1000-under-budget", median(runs) < TIMING.plans1000, `median ${Math.round(median(runs))} ms over ${TIMING.plans1000} ms`);
  }
  rmSync(dir, { recursive: true, force: true });
});

assertion("scale.100-plans", "scale", (expect) => {
  const dir = scaleStore(100, 30, 5);
  const store = readStore(dir);
  expect("scale.100-one-read-per-file", store.reads === 100, `${store.reads} read(s)`);
  timeRender(dir); // warm-up, so the first run's compilation is not the number
  const runs = [timeRender(dir), timeRender(dir), timeRender(dir), timeRender(dir), timeRender(dir)];
  ASSERTIONS.get("scale.100-plans").timing = `100 plans x 30 items: ${Math.round(median(runs))} ms on ${process.platform} node ${process.versions.node}`;
  if (process.env[ENV_READ] === "assert") {
    expect("scale.100-under-budget", median(runs) < TIMING.plans100, `median ${Math.round(median(runs))} ms over ${TIMING.plans100} ms`);
  } else {
    expect("scale.100-timing-printed", typeof ASSERTIONS.get("scale.100-plans").timing === "string", "no timing recorded");
  }
  rmSync(dir, { recursive: true, force: true });
});

// --- D11: progress and status lines -----------------------------------------

const manyPlans = (n) => Object.fromEntries(Array.from({ length: n }, (_, k) => [`p${k}.md`, planText(`p${k}`, { items: I(1) })]));

assertion("progress.11-plans", "progress-11-plans", (expect) => {
  const dir = makeStore(manyPlans(11));
  const out = [], err = [];
  const code = main(["--dir", dir, "--export", "csv"], { log: (s) => out.push(s), error: (s) => err.push(s) });
  // the order is the store's own (readdirSync sorts p10 before p2), not a counting loop's guess
  const order = readStore(dir).plans.map((p) => p.slug);
  expect("progress.11-lines", err.length === 11 && err.every((l, k) => l === progressLine(k + 1, 11, order[k])),
    `${err.length} stderr line(s): ${JSON.stringify(err.slice(0, 3))} vs ${JSON.stringify(order.slice(0, 3))}`);
  expect("progress.11-shape", err[0] === progressLine(1, 11, order[0]) && err[10] === progressLine(11, 11, order[10]),
    JSON.stringify([err[0], err[10]]));
  expect("progress.11-stdout", code === 0 && out.at(-1).startsWith("export: 11 plan(s) · ") && !out.some((l) => l.startsWith("plan ")),
    JSON.stringify(out));
  // D11 names `--wbs` AND `--export`; only the export was ever run. Both call one helper, but "both commands
  // emit them" is the claim, and a command that simply never called the helper would have passed.
  const wout = [], werr = [];
  const wcode = main(["--dir", dir, "--wbs"], { log: (s) => wout.push(s), error: (s) => werr.push(s) });
  expect("progress.11-wbs", wcode === 0 && werr.length === 11 && werr.every((l, k) => l === progressLine(k + 1, 11, order[k]))
    && wout.at(-1).startsWith("wbs: 11 plan(s) · ") && !wout.some((l) => l.startsWith("plan ")),
    JSON.stringify({ lines: werr.length, last: wout.at(-1) }));
  // and the status line is "always one of two shapes". The second shape — `<command>: nothing to do` — had no
  // assertion anywhere, and no command reaches it today, so it can only be pinned at the helper that builds it.
  const SHAPE = /^(wbs|export): (\d+ plan\(s\) · .+|nothing to do)$/;
  expect("progress.status-shapes", statusLine("wbs", 0, "", 0) === "wbs: nothing to do"
    && SHAPE.test(out.at(-1)) && SHAPE.test(wout.at(-1)),
    JSON.stringify([out.at(-1), wout.at(-1), statusLine("wbs", 0, "", 0)]));
});

assertion("progress.3-plans", "progress-3-plans", (expect) => {
  const dir = makeStore({
    ...manyPlans(3),
    "note.md": "a note with no front matter\n",
    "wbs.md": "| kind | id |\n|---|---|\n",
  });
  const out = [], err = [];
  const code = main(["--dir", dir, "--export", "csv"], { log: (s) => out.push(s), error: (s) => err.push(s) });
  expect("progress.3-silent", err.length === 0, JSON.stringify(err));
  expect("progress.3-status", code === 0 && out.at(-1) === statusLine("export", 3, `${countRows(snapshot(dir).tree)} row(s)`, 2),
    JSON.stringify(out.at(-1)));
  expect("progress.3-skipped", out.at(-1).endsWith("· skipped 2 non-plan file(s)"), JSON.stringify(out.at(-1)));
});

// --- case bounds (D31) ------------------------------------------------------

assertion("bounds.slug", "bounds", (expect) => {
  const bad = ["../etc", "a/b", "A", "x".repeat(65), ""];
  const lines = bad.map((s) => { try { parseArgs(["--html", s]); return "accepted"; } catch (e) { return e.line; } });
  // pair each slug with ITS OWN line. The old form looked the line up with indexOf, which finds the first
  // equal string rather than the current one, and then let anything starting `wbs: ` through — so five
  // different refusals, or five copies of one, read the same to it.
  expect("bounds.slug", lines.every((l, k) => l === fmt("badSlug", { slug: plainText(bad[k]) })),
    JSON.stringify(lines.map((l, k) => [bad[k].slice(0, 8), l])));
  // and the line has to NAME the input, which fmt("badSlug", …) cannot show on its own: it is the same
  // template the code formats with, so a template that stopped interpolating the slug would still match
  expect("bounds.slug-names-the-input", lines.every((l, k) => bad[k] === "" || l.includes(plainText(bad[k]))),
    JSON.stringify(lines));
  expect("bounds.slug-ok", parseArgs(["--html", "wbs-view"]).slug === "wbs-view");
  // D31 says each refusal exits 1 and writes nothing, which parseArgs alone cannot show: it throws before a
  // run exists. So run them, and read the store's contents before and after.
  const dir = makeStore({ "p.md": planText("p", { items: I(1) }) });
  const before = readdirSync(dir).sort().join(",");
  for (const [args, line] of [
    [["--html", "a/b"], fmt("badSlug", { slug: "a/b" })],
    [["--export", "csv", "--out", "x".repeat(OUT_MAX + 1)], fmt("outTooLong")],
  ]) {
    const r = runHtml(dir, ...args);
    expect("bounds.refusal-is-one-line-and-writes-nothing",
      r.code === 1 && r.line === line && r.out.length === 0 && readdirSync(dir).sort().join(",") === before,
      `${args[0]} -> code ${r.code} line ${JSON.stringify(r.line)} out ${r.out.length} files ${readdirSync(dir).join(",")}`);
  }
});

assertion("bounds.out", "bounds", (expect) => {
  let line = "accepted";
  try { parseArgs(["--export", "csv", "--out", "x".repeat(OUT_MAX + 1)]); } catch (e) { line = e.line; }
  expect("bounds.out", line === fmt("outTooLong"), line);
});

assertion("bounds.usage", "bounds", (expect) => {
  const cases = [[], ["--wbs", "--export", "csv"], ["--review", "--wbs"], ["--compact", "--export", "csv"], ["--nope"]];
  const lines = cases.map((c) => { try { parseArgs(c); return "accepted"; } catch (e) { return e.line; } });
  expect("bounds.usage", lines.every((l) => l === USAGE), JSON.stringify(lines.map((l) => l.slice(0, 20))));
});

assertion("bounds.limits-report", "bounds", (expect) => {
  // A9: D31 used to say these three were REFUSED and surfaced as D27's `does not parse`. They are not —
  // dod-index.mjs's LIMITS reports each as a warning, blanks an over-long line, and lets the plan parse and
  // render. That was found by probing rather than by reading, and it is asserted the same way: the plans go
  // into a store, the store is rendered, and the warnings come from checkPlan, which is what `--check` prints.
  const LONG = "y".repeat(12000);
  const dir = makeStore({
    "big.md": planText("big", { items: I(2), extra: `<!-- ${"x".repeat(1024 * 1024 + 1000)} -->\n\n` }),
    "many.md": planText("many", { items: I(501) }),
    "longline.md": planText("longline", { items: I(2), extra: `<!-- ${LONG} -->\n\n## After the long line\nstill parsed\n\n` }),
  });
  const store = readStore(dir);
  const by = Object.fromEntries(store.plans.map((p) => [p.slug, p]));
  const warnsOf = (slug) => checkPlan(by[slug], store.plans).warnings;
  expect("bounds.limit-1mb", warnsOf("big").includes("plan exceeds 1 MB"), JSON.stringify(warnsOf("big")));
  expect("bounds.limit-items", warnsOf("many").includes("plan exceeds 500 items"), JSON.stringify(warnsOf("many")));
  expect("bounds.limit-line", warnsOf("longline").some((w) => /^line \d+ is over 10,000 characters — skipped$/.test(w)),
    JSON.stringify(warnsOf("longline")));
  // the over-long line is blanked, not truncated to a prefix, and the section after it still parses — which
  // is the whole reason blanking is the response rather than dropping the line
  expect("bounds.long-line-blanked",
    !JSON.stringify(by.longline.sections).includes("yyyy") && "After the long line" in by.longline.sections,
    JSON.stringify(Object.keys(by.longline.sections)));
  // and all three still render, with their real item counts: reported is not refused
  const out = runHtml(dir, "--wbs");
  expect("bounds.limits-still-render",
    out.code === 0 && store.plans.length === 3
    && out.out.join("\n").includes("0/501") && /big\s+baseline\s+.*0\/2/.test(out.out.join("\n")),
    `${out.code} · ${JSON.stringify(out.out.at(-1))}`);
});

assertion("bounds.no-store", "bounds", (expect) => {
  const missing = join(tmpdir(), `dod-wbs-absent-${process.pid}`);
  let line = "accepted";
  try { readStore(missing); } catch (e) { line = e.line; }
  expect("bounds.no-store", line === fmt("noStore", { dir: plainText(missing) }), line);
});

const invoked = process.argv[1] && realpathSync(process.argv[1]) === SELF;
if (invoked) {
  try {
    process.exitCode = main(process.argv.slice(2), { log: (s) => console.log(s), error: (s) => console.error(s) }) ?? 0;
  } catch (e) {
    // D27: one line, the stated status, never a stack trace — including for a bug in this script
    if (e instanceof WbsError) { console.error(e.line); process.exitCode = e.code; }
    else { console.error(`wbs: ${plainText(String(e?.message ?? e))}`); process.exitCode = 1; }
  }
}

export { cleanLine, plainText, RUBRIC, ID_LEGEND, loadPlans, reportNumbers };
