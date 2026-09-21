#!/usr/bin/env node
// check-workflow.mjs — prove a GitHub Actions workflow runs `npm run validate` on both push and pull_request.
// Structural, not a text search: comments are stripped, the `on:` trigger set and every `jobs.<id>.steps[].run`
// scalar are read by indentation. Covers the YAML shapes workflows use for these keys (block mappings, block and
// flow sequences, plain and quoted scalars, `run: |` blocks); anything else is reported as not found. No dependencies.
//
//   node check-workflow.mjs <workflow.yml>   exit 0 when both triggers and the step are present, else 1
//   node check-workflow.mjs --selftest       workflows with the strings only in comments or in the wrong place fail

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Every character position outside a quoted scalar, in order. YAML escapes are honoured: inside "…" a backslash
// escapes the next character; inside '…' a doubled '' is a literal quote. Quote characters themselves are not yielded.
function* unquoted(text) {
  let q = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q === '"') { if (c === "\\") i++; else if (c === '"') q = null; continue; }
    if (q === "'") { if (c === "'" && text[i + 1] === "'") i++; else if (c === "'") q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    yield [i, c];
  }
}

// Remove a comment that starts at `#` preceded by whitespace (or at column 0), outside quotes.
function stripComment(line) {
  for (const [i, c] of unquoted(line)) if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  return line.trimEnd();
}
const unquote = (v) => v.trim().replace(/^(['"])(.*)\1$/, "$2");
const indentOf = (l) => l.length - l.trimStart().length;

// Top-level entries of a flow collection's inside (`a, b: {c: d}, "e,f"`), split at commas outside quotes and brackets.
function flowEntries(inner) {
  const cuts = [];
  let depth = 0;
  for (const [i, c] of unquoted(inner)) {
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) cuts.push(i);
  }
  const out = [];
  let from = 0;
  for (const i of [...cuts, inner.length]) { const e = inner.slice(from, i).trim(); if (e) out.push(e); from = i + 1; }
  return out;
}
// The key of a flow-mapping entry: text before the first `:` outside quotes (the whole entry when it has none).
function flowKey(entry) {
  for (const [i, c] of unquoted(entry)) if (c === ":") return entry.slice(0, i).trim();
  return entry.trim();
}

// The lines of the block that starts after line `from` and whose lines are indented deeper than `indent`
// (a sequence may sit at its key's own indent, so `- ` lines at exactly `indent` count when `seqAtIndent`).
function block(lines, from, indent, seqAtIndent = false) {
  const out = [];
  for (let k = from + 1; k < lines.length; k++) {
    const c = lines[k];
    if (!c.trim()) continue;
    const n = indentOf(c);
    if (n > indent || (seqAtIndent && n === indent && /^-(\s|$)/.test(c.trim()))) out.push(k);
    else break;
  }
  return out;
}

// Only `jobs.<id>.steps[].run` scalars: each job's direct `steps:` key, each step mapping's direct `run:` key.
function stepRuns(lines, jobsLine) {
  const runs = [];
  const inJobs = block(lines, jobsLine, 0);
  if (!inJobs.length) return runs;
  const jobIndent = indentOf(lines[inJobs[0]]);
  for (const j of inJobs) {
    if (indentOf(lines[j]) !== jobIndent || !/^["']?[\w-]+["']?\s*:\s*$/.test(lines[j].trim())) continue;
    const inJob = block(lines, j, jobIndent);
    if (!inJob.length) continue;
    const keyIndent = indentOf(lines[inJob[0]]);
    for (const k of inJob) {
      if (indentOf(lines[k]) !== keyIndent || !/^steps\s*:\s*$/.test(lines[k].trim())) continue;
      const inSteps = block(lines, k, keyIndent, true);
      if (!inSteps.length) continue;
      const itemIndent = indentOf(lines[inSteps[0]]);
      for (const s of inSteps) {
        const line = lines[s];
        if (indentOf(line) !== itemIndent || !/^-\s+/.test(line.trim())) continue;
        // the step mapping: the text after "- " on the item line, then lines at that text's column
        const contentIndent = itemIndent + line.trim().match(/^-\s+/)[0].length;
        const keys = [[s, line.trim().replace(/^-\s+/, "")]];
        for (const t of block(lines, s, itemIndent)) if (indentOf(lines[t]) === contentIndent) keys.push([t, lines[t].trim()]);
        for (const [t, kv] of keys) {
          const rm = kv.match(/^run\s*:\s*(.*)$/);
          if (!rm) continue;
          const v = rm[1].trim();
          if (/^[|>][-+]?$/.test(v)) runs.push(...block(lines, t, contentIndent).map((b) => lines[b].trim()));
          else runs.push(unquote(v));
        }
      }
    }
  }
  return runs;
}

export function inspect(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map(stripComment);
  const triggers = new Set(), runs = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || indentOf(l) !== 0) continue;
    const m = l.match(/^(["']?)(on|true)\1\s*:\s*(.*)$/); // YAML 1.1 parsers read a bare `on` key as true
    if (m) {
      const inline = m[3].trim();
      if (inline) {
        if (inline.startsWith("[")) flowEntries(inline.slice(1, inline.lastIndexOf("]"))).forEach((x) => triggers.add(unquote(x)));
        else if (inline.startsWith("{")) flowEntries(inline.slice(1, inline.lastIndexOf("}"))).forEach((x) => triggers.add(unquote(flowKey(x))));
        else triggers.add(unquote(inline));
        continue;
      }
      let childIndent = null;
      for (let k = i + 1; k < lines.length && (!lines[k].trim() || indentOf(lines[k]) > 0); k++) {
        const c = lines[k];
        if (!c.trim()) continue;
        if (childIndent === null) childIndent = indentOf(c);
        if (indentOf(c) !== childIndent) continue;
        const km = c.trim().match(/^-\s+(.+)$/) ?? c.trim().match(/^(["']?[\w-]+["']?)\s*:/);
        if (km) triggers.add(unquote(km[1].replace(/:.*$/, "")));
      }
      continue;
    }
    if (/^jobs\s*:\s*$/.test(l)) runs.push(...stepRuns(lines, i));
  }
  const validate = runs.some((r) => r === "npm run validate" || r.startsWith("npm run validate ") || r.startsWith("npm run validate&"));
  return { triggers: [...triggers], runs, ok: triggers.has("push") && triggers.has("pull_request") && validate };
}

function selftest() {
  const good = "name: v\non:\n  push:\n    branches: [main]\n  pull_request:\njobs:\n  v:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm run validate\n";
  const cases = [
    ["block mapping", good, true],
    ["flow sequence", "on: [push, pull_request]\njobs:\n  v:\n    steps:\n      - run: npm run validate -- --table\n", true],
    ["run block", "on:\n  - push\n  - pull_request\njobs:\n  v:\n    steps:\n      - name: all\n        run: |\n          npm ci\n          npm run validate\n", true],
    ["only in comments", "# on: [push, pull_request]\non:\n  workflow_dispatch:\n# pull_request:\njobs:\n  v:\n    steps:\n      # - run: npm run validate\n      - run: echo hi # npm run validate\n", false],
    ["push only", good.replace("  pull_request:\n", ""), false],
    ["validate outside jobs", "on: [push, pull_request]\nenv:\n  run: npm run validate\njobs:\n  v:\n    steps:\n      - run: npm test\n", false],
    ["flow mapping", "on: {push: null, pull_request: {branches: [main, dev]}}\njobs:\n  validate:\n    steps:\n      - run: npm run validate\n", true],
    ["flow mapping nested only", "on: {push: {pull_request: x}, workflow_dispatch: null}\njobs:\n  validate:\n    steps:\n      - run: npm run validate\n", false],
    ["flow mapping quoted comma", "on: {\"push, pull_request\": null}\njobs:\n  validate:\n    steps:\n      - run: npm run validate\n", false],
    ["flow escaped double quote", "on: {push: {branches: [\"a\\\",b\"]}, pull_request: {}}\njobs:\n  validate:\n    steps:\n      - run: npm run validate\n", true],
    ["flow doubled single quote", "on: {push: {branches: ['it''s,x']}, pull_request: {}}\njobs:\n  validate:\n    steps:\n      - run: npm run validate\n", true],
    ["comment after escaped quote", "on: [push, pull_request]\njobs:\n  v:\n    steps:\n      - run: \"echo \\\" # not a comment\" # npm run validate\n", false],
    ["steps at key indent", "on: [push, pull_request]\njobs:\n  v:\n    steps:\n    - uses: actions/checkout@v4\n    - name: v\n      run: npm run validate\n", true],
    ["run under job env", "on: [push, pull_request]\njobs:\n  validate:\n    env:\n      run: npm run validate\n    steps:\n      - run: npm test\n", false],
    ["run as job key", "on: [push, pull_request]\njobs:\n  validate:\n    run: npm run validate\n    steps:\n      - run: npm test\n", false],
    ["run nested in step with", "on: [push, pull_request]\njobs:\n  v:\n    steps:\n      - uses: x/y@v1\n        with:\n          run: npm run validate\n", false],
    ["trigger nested deeper", "on:\n  push:\n    pull_request: x\njobs:\n  v:\n    steps:\n      - run: npm run validate\n", false],
  ];
  const bad = cases.filter(([, text, want]) => inspect(text).ok !== want);
  console.log(`check-workflow selftest: ${cases.length - bad.length}/${cases.length} cases${bad.length ? ` — failed: ${bad.map(([n]) => n).join(", ")}` : ""}`);
  return bad.length ? 1 : 0;
}

function main(argv) {
  const arg = argv[2];
  if (arg === "--selftest") return selftest();
  if (!arg) { console.error("usage: check-workflow.mjs <workflow.yml> | --selftest"); return 1; }
  let text;
  try { text = readFileSync(arg, "utf8"); } catch (e) { console.error(`check-workflow: cannot read ${arg} (${e.code ?? "error"})`); return 1; }
  const r = inspect(text);
  console.log(`check-workflow: triggers ${r.triggers.join(", ") || "none"} · npm run validate step ${r.runs.some((x) => x.startsWith("npm run validate")) ? "present" : "missing"} · ${r.ok ? "ok" : "FAIL"}`);
  return r.ok ? 0 : 1;
}

const direct = (() => { try { return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (direct) process.exit(main(process.argv));
