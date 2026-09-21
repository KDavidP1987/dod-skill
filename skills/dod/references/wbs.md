# wbs.md — the work-breakdown view, its exports and its pages

`scripts/dod-wbs.mjs` is a **read-only view over a plan store**. It never edits a plan: `dod-index.mjs` is
the referee that parses and checks plans, and this script renders what that referee already accepts. It
writes only what you ask it to write — one export file, or one HTML page — and always under the store.

Read this before running `--wbs`, `--export` or `--html`, or before ticking a plain-text surface against the
checklist at the end.

```bash
node skills/dod/scripts/dod-wbs.mjs [--dir <store>] --wbs [--compact] [--versions <n>|all]
node skills/dod/scripts/dod-wbs.mjs [--dir <store>] --export csv|md [--out <path>]
node skills/dod/scripts/dod-wbs.mjs [--dir <store>] --html <slug> [--review] [--out <path>]
node skills/dod/scripts/dod-wbs.mjs --selftest
```

The store defaults to the `dod-store:` line in the instructions file, else `docs/dod`.

## What the tree shows

`--wbs` prints the store as a tree: the store, then each root plan, then its children by `parent:`, then —
for a plan that has one — its `## Work breakdown` packages and leaves. Each row carries the verified count
and percentage **rolled up** from everything under it, so a parent's number is the sum of its children's,
not a number of its own. The denominator counts **items, not packages**: a package holding many small items
weighs more than one holding few large ones, which is the same denominator `--check`, `--brief` and the
report already use.

- **Origin** marks where a row came from: `baseline` (in the plan when it was frozen), `amended` (added by
  an amendment), `package` (a `## Work breakdown` row).
- **Columns** are the declared versions a plan names. `--versions <n>` keeps the newest *n*; `--versions all`
  keeps every one and warns on stderr when that runs past the readable width.
- `--compact` prints one line per plan instead of the tree.
- The store is read three times and compared. One change between reads is re-read silently; a second prints
  `wbs: the store changed while it was being read — this snapshot is inconsistent` **on stderr** and still
  renders the last complete read, exiting 0. A warning is not a failure: you get a tree, and you are told it
  may be a moment stale.

## The exports

`--export csv` and `--export md` write the same tree as a table. Both write under the store by default
(`wbs.csv`, `wbs.md`) and refuse any destination that is a plan file, a `*.reviews.md`, the store's
`README.md`, a path outside the store, or a symbolic link.

A CSV cell that would begin `=`, `+`, `-` or `@` is written with a leading apostrophe, so a spreadsheet
treats it as text rather than a formula. **That apostrophe is visible in a plain text editor and hidden by
Excel and LibreOffice Calc** — which is why the checklist below asks you to open the file in all three.

## The two pages

`--html <slug>` writes `<store>/<slug>.html`: a legend, the package tree with rolled-up percentages, the
item table, the probe matrix, amendments by kind, the prediction rate per declared version and the Log
notes. Every section is either present with its rows or **present and marked absent with the reason** —
never silently missing.

`--html <slug> --review` writes `<store>/<slug>.review.html`, the page a reviewer reads. It lists every
layer of the plan's rubric in order, each probe with its text taken from `layers.md`, and beside each probe
the plan's own answer and the items the Coverage pointer maps to. A probe with no answer reads `no answer`,
visibly. A layer the author declared not applicable shows its applicability test — the thing the reviewer is
there to contest — and never a score.

**The review page is score-redacted by design.** It carries no Coverage status, no probe count, no
`coverage_author`, no `coverage_reviewer`, no gate line and no verdict, so a reviewer cannot read the
author's own score before forming one.

Both pages are a single self-contained file: no script, no stylesheet link, no `src`, no remote `href`.
Every string that comes from a plan is escaped at the one place the surface is built.

`scripts/checks/page-check.mjs` is the dev-only checker that opens both pages in headless Chromium at
375 × 812 and 1280 × 900, in light and dark, and asserts what a text selftest cannot see. It is not part of
the skill: it lives in `scripts/checks/`, has its own `package.json`, and nothing under `skills/` imports it.

## Failure classes

One row per class. The **message** column is the string the script prints, with `<…>` for the parts filled
in at run time. Each script checks its own rows against this table — `dod-wbs.mjs` its own, `page-check.mjs`
its own — so neither has to import the other, and `npm run validate` keeps working on a machine that has
never installed `scripts/checks/`.

The scripts named in this table are `dod-wbs.mjs` and `page-check.mjs`.

**One exemption, stated rather than hidden:** the usage block of each script is several lines by design, so
it is cited here by its first line only. Every other row is the whole message.

| Script | Message | Exit | What you do next |
|---|---|---|---|
| `dod-wbs.mjs` | `usage: dod-wbs.mjs [--dir <store>] --wbs [--compact] [--versions <n>]` | 1 | Run one mode at a time; `--review` needs `--html`, `--compact` and `--versions` need `--wbs`. |
| `dod-wbs.mjs` | `wbs: no plan store at <dir>` | 1 | Point `--dir` at the store, or run `dod setup` to create one. |
| `dod-wbs.mjs` | `wbs: no plan <slug> in <dir>` | 1 | Check the slug against `--wbs`, which lists every plan in the store. |
| `dod-wbs.mjs` | `wbs: <slug>.md does not parse — run dod-index.mjs --check <slug>` | 1 | Run that command: it names the grammar problem and the line. |
| `dod-wbs.mjs` | `wbs: <path> is a plan file — exports are never written over plans` | 1 | Choose another `--out`. A plan, a `*.reviews.md` and the store's `README.md` are never export targets. |
| `dod-wbs.mjs` | `wbs: cannot read <file> (<code>)` | 1 | Fix the file's permissions, or remove it from the store if it is not a plan. |
| `dod-wbs.mjs` | `wbs: <path> is outside the store — exports are written under <store>` | 1 | Give `--out` a path under the store. |
| `dod-wbs.mjs` | `wbs: <path> is a link — refusing to write through it` | 1 | Write to a real path; the script never follows a link to its target. |
| `dod-wbs.mjs` | `wbs: the store changed while it was being read — this snapshot is inconsistent` | 0 | Nothing, unless it matters: you have the last complete read. Re-run for a current one. |
| `dod-wbs.mjs` | `wbs: <slug> is not a slug — 1 to 64 characters of a-z, 0-9 and -` | 1 | Use the plan's file name without `.md`. |
| `dod-wbs.mjs` | `wbs: --out path is over 4,096 characters` | 1 | Shorten the path. |
| `page-check.mjs` | `usage: page-check.mjs <page.html> [<page.html> ...] [--out <dir>]` | 1 | Name one or more pages. `--out` is optional. |
| `page-check.mjs` | `page-check: <path> is not a file` | 1 | Generate the page first with `dod-wbs.mjs --html <slug>`. |
| `page-check.mjs` | `page-check: <path> is not a .html page` | 1 | Pass the page, not the plan. |
| `page-check.mjs` | `page-check: <out> is not a directory` | 1 | Point `--out` at a directory, or remove the file sitting at that path. |
| `page-check.mjs` | `page-check: chromium timed out after <n> s (<stage>)` | 1 | Re-run. If it repeats, the browser is wedged: delete the cache directory and install Chromium again. |
| `page-check.mjs` | `page-check: cannot start chromium (<code>) — install it with PLAYWRIGHT_BROWSERS_PATH=<cache> npx playwright install chromium` | 1 | Run that command, from `scripts/checks/`, once per machine. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> scrolls <n> px wider than the window` | 1 | Find what is holding the width open — usually an unbroken string or a fixed `min-width`. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> sets no background of its own` | 1 | Give `body` a background from a token; a transparent body borrows the host's. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> sets no text colour of its own` | 1 | Give `body` a colour from the same token set as its background. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> skips a heading level (h<a> to h<b>)` | 1 | Use the next level down; a skipped level breaks the document outline. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> has <n> table(s) with no header cells` | 1 | Give each table a `<thead>` of `<th scope="col">`. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> has no same-page link to take focus` | 1 | The page is expected to link to its own items; check the renderer. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> shows no focus ring on <sel>` | 1 | Restore the `:focus-visible` outline; never `outline: none` without a replacement. |
| `page-check.mjs` | `page-check: <page> at <w>x<h> <theme> body contrast is <r>:1, under 4.5:1` | 1 | Darken the text or lighten the ground until the ratio reaches 4.5:1. |
| `page-check.mjs` | `page-check: <n> file(s) under <out>, expected <want>` | 1 | Empty `--out` and re-run; a leftover file from an earlier run counts. |
| `page-check.mjs` | `page-check: <path> was written outside --out` | 1 | A screenshot landed beside its page. Check the `--out` path the run was given. |

## The plain-text checklist

The surfaces below are read by a person, not by a script, because the thing being checked is whether they
are *readable* — and each renderer shows them differently. Record each one's result separately.

Open each of these:

1. `wbs.md` in a Markdown preview.
2. `wbs.md` in a plain terminal (`cat` it — no pager, no syntax colouring).
3. `wbs.csv` in a plain text editor.
4. `wbs.csv` in Microsoft Excel.
5. `wbs.csv` in LibreOffice Calc.
6. One `--wbs --compact` line.
7. One status line (the last line `--wbs` prints).

And for each, check:

- [ ] **Header rows are present** and name every column — no table starts at its data.
- [ ] **Links resolve to plan files** that exist in the store, not to a slug that has been renamed away.
- [ ] **No meaning is carried by colour alone.** Every state that a colour marks also reads as a word or a
      symbol, so the surface survives a plain terminal, a monochrome print and a reader who cannot see the
      difference.
- [ ] **The one-liners fit 120 columns.** The compact line and the status line each wrap nowhere.
- [ ] **The reading order is the tree's order** — a row's parent is always above it, and a roll-up total is
      never read before the rows it totals.
- [ ] **The leading apostrophe on a formula-like cell** is visible in the text editor, and absent in both
      Excel and LibreOffice Calc. This is the D7 defence against a spreadsheet executing a plan's text, and
      it is why all three are on the list rather than one.

`audit` and `enhance` are not part of this view and do not exist yet.
