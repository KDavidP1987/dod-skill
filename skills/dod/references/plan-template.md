# Plan file — `<store>/<slug>.md`

One file per item. It is the plan, the tracker, and the report. `scripts/dod-index.mjs` parses the
grammar below and enforces the invariants at the end. In the grammar-controlled sections (Definition of
Done, Baseline, Coverage, Assumptions, Amendments, Children, Log) a bullet or table row that does not
match its grammar is reported as a problem — a misspelled `decision-required` cannot silently vanish.
Read this file before writing or editing any plan.

## Frontmatter — one scalar per line, no nesting, no quotes

Copy this block as-is (nothing but values inside it); the meaning of each field is in the table below.

```
---
dod: 1
id: dod-20260914-k3f9
slug: export-csv
title: CSV export of invoices
status: draft
size: M
parent: none
created: 2026-09-14
baselined: none
closed: none
commit: 3f2a9c1
coverage_author: 14/14 layers · 42/42 probes
coverage_reviewer: pending
review: pending
---
```

| Field | Values | Notes |
|---|---|---|
| `id` | `dod-YYYYMMDD-xxxx` (4 lowercase alphanumerics) | immutable; unique per store; survives renames |
| `slug` | kebab-case | mutable label; must equal the filename |
| `status` | `draft` `ready` `in-progress` `done` `cancelled` `superseded` | must equal the last Log transition |
| `size` | `S` `M` `L` `Epic` | |
| `parent` | epic slug or `none` | |
| `created` | date | |
| `baselined` | date or `none` | set by `approve`; **kept** if the plan is later cancelled or superseded |
| `closed` | date or `none` | set exactly for `done` / `cancelled` / `superseded` |
| `commit` | repo commit the recon read, or `none` | |
| `coverage_author` | `a/b layers · c/d probes` or `pending` | applicable layers and probes only (N/A excluded); must equal the Coverage table from `ready` on |
| `coverage_reviewer` | same shape or `pending` | must equal the latest READY review's coverage line from `ready` on |
| `review` | `pending` `codex` `subagent` `human` | never `self`; must name the reviewer of the latest READY review |

## Body — sections in this order

```markdown
# DoD: <title>

**Size:** M — touches `billing/` and adds a schema column (L test: no new external dependency).
**Planned:** interactively | autonomously (assumptions marked reversible were decided without asking)
**Request:** <the user's words, verbatim>

## Definition of Done
- [ ] D1 · <verifiable statement> · test: <test file or name>
- [ ] D2 · <verifiable statement> · cmd: <command> → <expected output>
- [ ] D3 · <verifiable statement> · file: <path that must exist, optionally "contains <text>">
- [ ] D4 · <verifiable statement> · manual: <steps a person performs and what they must observe>

## Purpose & typical use
## Use cases
### Typical
### Minimal stretch
### Maximal stretch
## Business rules
## Interfaces
### Internal — reads / writes / changes (paths or symbols)
### External — dependencies and their failure behaviour
## Design
### Data
### States
### Permissions
### UX  (omit when layer 11 is N/A)
## Security
## Failure & observability
## Performance
## Build plan
1. <step an agent that has never seen this conversation can execute — paths, commands, schemas> · satisfies D1, D3
## Rollout
## Out of scope
## Also considered
## Assumptions
- A-1 · validated · <statement> · source: <path / doc / "user confirmed 2026-09-14">
- A-2 · reversible · <decision taken without asking> · fallback: <what changes, and how cheaply, if it is wrong>
- A-3 · decision-required · <statement>     ← a Gap; the plan cannot be ready while one exists
## Coverage
| # | Layer | Status | Probes | Pointer / reason |
|---|---|---|---|---|
| 1 | Purpose & typical use | Considered | 3/3 | Purpose & typical use |
| 2 | Actors & permissions | Considered | 3/3 | Design › Permissions › D2, D6 |
| … | (all 15 rows, always, in this order, with the canonical layer names from layers.md) | | | |
| 6 | External dependencies & contracts | Gap | 1/3 | 6.2, 6.3 unanswered |
| 7 | States & lifecycle | Considered | 3/3 | Design › States › D5 (7.3 examined: no concurrent writers, single cron; still counted) |
| 11 | Design & UX | N/A | — | no human-facing surface: nightly job, checked src/jobs/ |
Gate — acceptance & testability: passed — every Considered layer 2–14 maps to ≥ 1 D-item

Pointer format for a Considered row: `<heading in this plan> › <optional sub-heading> › <D-items>`. The
first segment must be a heading that exists in the plan; for layers 2–14 the pointer must name at least
one current D-item — that is how the acceptance gate is checked. Layers 1 and 15 need only the heading.

Probe denominators are **fixed** by layers.md (3/3, 4/4 …). N/A exists only at layer level. A single probe
you examined and found inapplicable is *answered* — write the test you performed in the section and count
it — so a layer can never show `1/1` where the rubric has four probes.

## Baseline
<verbatim copy of the Definition of Done lines at approve — never edited>

## Amendments
- A1 · 2026-09-16 · discovered · +D13 · layer: 7.2 · retry racing the original created duplicate exports
- A2 · 2026-09-17 · requested · ~D2 · layer: — · user asked for XLSX as well as CSV
- A3 · 2026-09-17 · defect · — · layer: — · off-by-one in pagination; D5 already covered the behaviour

## Children            (Epic only)
- export-csv · in-progress
- export-xlsx · planned

## Log
- 2026-09-14 · status → draft · plan
- 2026-09-15 · status → ready · approve · review: codex
- 2026-09-15 · status → in-progress · start
- 2026-09-16 · D1 · pass · test: billing/export.test.ts (9 pass) · 7b1e2f0 · claude
- 2026-09-16 · D4 · pass · manual: opened /invoices, clicked Export, file downloaded in <2 s · 7b1e2f0 · kd
- 2026-09-16 · D2 · fail · cmd: npm run lint → 3 errors · 7b1e2f0 · claude
- 2026-09-20 · status → in-progress · reopen A4
- 2026-09-21 · renamed from export-invoices
- 2026-09-21 · note · anything else worth a dated line

## Report
<written by close / report — see lifecycle.md>
```

## Grammar the script parses

Separator is ` · ` (space, U+00B7 middle dot, space). Never use `·` inside a field.

| Thing | Line | Rules |
|---|---|---|
| DoD item | `- [ ] Dn · statement · type: detail` | `type` ∈ `test` `cmd` `file` `manual`; `[x]` = checked; IDs never reused |
| Baseline item | same shape, under `## Baseline` | |
| Amendment | `- An · YYYY-MM-DD · kind · ops · layer: L · why` | ids sequential from A1, dates valid and non-decreasing. `kind` ∈ `discovered` `requested` `defect` `external`. `ops` = space-separated `+Dn` `-Dn` `~Dn`, or `—` for none; `+` may not reuse any ID ever used in this plan. `discovered` must give `L` as a layer (`7`) or probe (`7.2`); others may use `—` |
| Coverage row | `\| n \| Layer \| Considered\|Gap\|N/A \| a/b \| pointer or reason \|` | exactly 15 rows, numbered 1–15 in order, canonical names; `b` **equals** the rubric's probe count for that layer; Considered needs a = b and a pointer that names a real heading (and ≥ 1 D-item for layers 2–14); Gap needs a < b; N/A needs the applicability test as its reason (the script only checks it is there — ≥ 12 chars; the reviewer checks it is true) |
| Gate line | `Gate — acceptance & testability: passed\|failed …` | in `## Coverage` |
| Assumption | `- A-n · validated · statement · source: <…>` · `- A-n · reversible · decision · fallback: <…>` · `- A-n · decision-required · statement` | `validated` without `source:` or `reversible` without `fallback:` is a grammar error |
| Child (Epic) | `- slug · planned\|in-progress\|done` | under `## Children` |
| Log — transition | `- YYYY-MM-DD · status → <status> · <command>` | exact commands: `draft · plan`, `ready · approve` (optionally `· review: codex`), `in-progress · start`, `in-progress · reopen An` (An exists, dated on/before), `done · close`, `cancelled · cancel · <reason>`, `superseded · supersede · by <slug>` (slug in the store); dates non-decreasing |
| Log — evidence | `- YYYY-MM-DD · Dn · pass\|fail · type: detail · commit · who` | `type` must equal the item's type; `commit` = repo commit or `none`; `who` = agent or person |
| Log — other | `- YYYY-MM-DD · review skipped — <reason>` · `- YYYY-MM-DD · renamed from <slug>` · `- YYYY-MM-DD · note · <text>` | the only other bullets allowed in `## Log` |

## Invariants the script enforces (`--check <slug>`; exit 1 on any)

0. **Frontmatter** — every field above present; `status`, `size`, `review` from their enums; `id` is
   `dod-YYYYMMDD-xxxx` and unique in the store; dates valid; `baselined` set iff the Log contains a
   `→ ready` transition (so a cancelled or superseded plan that was once ready keeps it); `closed` set
   exactly for terminal states; coverage fields are `a/b layers · c/d probes` or `pending`;
   `coverage_reviewer` set from `ready` on.
1. **Coverage** — 15 rows numbered 1–15 in order with canonical names; probe denominators equal the
   rubric's; Considered = `a/a` + a pointer to a real heading (+ ≥ 1 current D-item for layers 2–14); Gap
   = `a/b` with a < b; N/A has an applicability test. From `ready` on: no Gap rows, gate `passed`,
   `coverage_author` equals the line computed from the table.
2. **Amendments** — ids sequential, dates valid and non-decreasing; every op token is `+Dn`, `-Dn`, `~Dn`
   or `—`; `+` never reuses an ID that ever existed; `-` and `~` name an ID that exists at that point; a
   `discovered` amendment names a layer or probe.
3. **Baseline** — from `ready` on: current DoD IDs = Baseline IDs + amendment ops, and every item that is
   in the Baseline and has no `~Dn` amendment is identical to its Baseline line (apart from the checkbox).
4. **Evidence** — an evidence line's type equals its item's type. A `[x]` is verified only by a `pass`
   that appears **after** the last `fail` for that item in Log order **and** is dated on/after the item's
   last `+Dn`/`~Dn` amendment (a changed item needs fresh evidence). Otherwise: "checked without evidence".
5. **Review** — `review` ∈ `pending | codex | subagent | human`. Reviews are numbered sequentially with
   non-decreasing dates, and **the latest review is the one on record**: a later `REVISE` cancels an
   earlier `READY`. From `ready` on, `review` is not pending, the latest review is `VERDICT: READY` with a
   reviewer coverage line and a disposition for every finding `Fn`, `review:` names that reviewer,
   `coverage_reviewer` equals that review's coverage line, and a READY review is dated on/before
   `baselined`. **Re-review triggers:** an amendment whose `layer:` is a gating probe (2.1, 3.3, 4.4,
   6.2, 10.1, 10.3, 14.3) or whose ops remove an item (`-Dn`) requires a READY review dated on/after it
   before `done`, and `review: pending` until then. `+Dn` and `~Dn` alone do not reopen review — they
   are material to the *plan* (recorded as amendments, counted by the report) but not to the *review*.
6. **Lifecycle** — the Log transitions replay legally: `draft → ready → in-progress → done`;
   `cancelled`/`superseded` from any open state; `done → in-progress` only as `reopen An` citing an
   existing amendment dated on/before it; every transition line carries its exact command (grammar table
   above); `supersede · by <slug>` names a plan in the store; dates non-decreasing. Frontmatter `status`
   equals the last transition.
7. **Done** — every current item checked and verified; `## Report` non-empty; an Epic has ≥ 1 child and
   every declared child is `done`. `## Children` may only appear in an Epic.
8. **Parent / children** — `parent` resolves to an Epic that lists this slug; a manifest status that
   disagrees with the child's plan is a warning; a missing child file is a warning until `done`.
9. **Assumptions** — each line matches its type's grammar (`validated` has `source:`, `reversible` has
   `fallback:`); no `decision-required` assumption past `draft`.

What the script does **not** judge: whether a pointer's section actually answers the probe, whether an
N/A reason is true, whether an amendment's kind is honest, whether the report's prose matches. Those
are the reviewer's and the user's — `close` shows every excluded amendment (`requested`/`defect`/
`external`) with its `why` for the user to confirm before the rate is reported.

Prediction rate counts **design changes**, not amendment lines: each `+Dn` / `~Dn` in a `discovered`
amendment is one; a `discovered` amendment with no ops counts as one. Bundling discoveries into one
amendment does not lower the rate. The unit on both sides is the D-item: baseline items over baseline
items plus discovered item changes. Padding the baseline with trivially split items is visible — the
index shows baseline item counts next to the rate.

## Reviews file — `<store>/<slug>.reviews.md`

Reviews never live in the plan (a later reviewer must not see an earlier critique). Append-only:

```markdown
## Review 1 · 2026-09-15 · codex · plan commit 3f2a9c1
F1 blocking · <finding> — <fix>
F2 advisory · <finding> — <fix>
14/14 layers · 42/42 probes
VERDICT: READY
### Dispositions
- F1 · accepted · added 6.2 failure behaviour; +D9
- F2 · rejected · <reason>
```
Parsed: the heading `## Review n · date · codex|subagent|human`, every `Fn` finding, the reviewer's
coverage line (`a/b layers · c/d probes`, required for READY), the `VERDICT:` line, and `- Fn · accepted|
rejected · …` under `### Dispositions` — every finding must have one. For a human review, write the
user's answers as findings (or `F1 · no blocking gaps found`) so the same grammar applies. Number reviews
1, 2, 3 … in order with non-decreasing dates; the script treats the **last** review as the verdict on
record, so a REVISE appended after a READY puts the plan back to `review: pending` until the next READY.

## Store location

Default `docs/dod/`. A project that keeps it elsewhere writes `dod-store: <path>` on its own line inside
the pointer block (setup.md); paths may contain spaces. The script reads that line from `CLAUDE.md`,
`AGENTS.md` or `.cursor/rules/dod.mdc` in the working directory when `--dir` is not given, and refuses
to run if they disagree.
