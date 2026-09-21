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
dod: 2
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
| `dod` | `1` or `2` | the format version: `2` = titled items and `S-n` assumptions (see ID legend); new plans are written at `2` |
| `id` | `dod-YYYYMMDD-xxxx` (4 lowercase alphanumerics) | immutable; unique per store; survives renames |
| `slug` | kebab-case | mutable label; must equal the filename |
| `status` | `draft` `ready` `in-progress` `done` `cancelled` `superseded` | must equal the last Log transition |
| `size` | `S` `M` `L` `Epic` | |
| `parent` | any plan's slug or `none` | the parent must list this plan under `## Children` (v0.2 additions) |
| `kind` | `feature` `product` `backlog` — optional | absent means `feature` (v0.2 additions) |
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
- [ ] D1 · **CSV download** <verifiable statement> · test: <test file or name>
- [ ] D2 · **Lint clean** <verifiable statement> · cmd: <command> → <expected output>
- [ ] D3 · **Export doc** <verifiable statement> · file: <path that must exist, optionally "contains <text>">
- [ ] D4 · **One-click export** <verifiable statement> · manual: <steps a person performs and what they must observe>

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
## Work breakdown     (required at rubric 2 for L and Epic; see "Work packages" below)
- W1 · **<parent title>**
- W1.1 · **<leaf title>** · items: D1 D3 · steps: 1, 2
- W1.2 · **<leaf title>** · items: D2 · steps: 2
## Rollout
## Out of scope
## Also considered
## Assumptions
- S-1 · validated · <statement> · source: <path / doc / "user confirmed 2026-09-14">
- S-2 · reversible · <decision taken without asking> · fallback: <what changes, and how cheaply, if it is wrong>
- S-3 · decision-required · <statement>     ← a Gap; the plan cannot be ready while one exists
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
- A1 · 2026-09-16 · discovered · +D13 · layer: 7.2 · package: W1.2 · retry racing the original created duplicate exports
- A2 · 2026-09-17 · requested · ~D2 · layer: — · user asked for XLSX as well as CSV
- A3 · 2026-09-17 · defect · — · layer: — · off-by-one in pagination; D5 already covered the behaviour

## Children            (any size; an Epic must have one)
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
| DoD item | `- [ ] Dn · **title** statement · type: detail` | `type` ∈ `test` `cmd` `file` `manual`; `[x]` = checked; IDs never reused; the title is required at `dod: 2` (ID legend) |
| Baseline item | same shape, under `## Baseline` | |
| Amendment | `- An · YYYY-MM-DD · kind · ops · layer: L · why` | ids sequential from A1, dates valid and non-decreasing. `kind` ∈ `discovered` `requested` `defect` `external`. `ops` = space-separated `+Dn` `-Dn` `~Dn`, or `—` for none; `+` may not reuse any ID ever used in this plan. `discovered` must give `L` as a layer (`7`) or probe (`7.2`); others may use `—` |
| Coverage row | `\| n \| Layer \| Considered\|Gap\|N/A \| a/b \| pointer or reason \|` | exactly 15 rows, numbered 1–15 in order, canonical names; `b` **equals** the rubric's probe count for that layer; Considered needs a = b and a pointer that names a real heading (and ≥ 1 D-item for layers 2–14); Gap needs a < b; N/A needs the applicability test as its reason (the script only checks it is there — ≥ 12 chars; the reviewer checks it is true) |
| Gate line | `Gate — acceptance & testability: passed\|failed …` | in `## Coverage` |
| Assumption | `- S-n · validated · statement · source: <…>` · `- S-n · reversible · decision · fallback: <…>` · `- S-n · decision-required · statement` (`A-n` at `dod: 1`) | `validated` without `source:` or `reversible` without `fallback:` is a grammar error |
| Child | `- slug · planned\|in-progress\|done[ · baseline\|An]` | under `## Children`; the origin field is a v0.2 addition |
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
   every declared child is `done`, names this Epic as its parent and passes its own check. `## Children` may appear on any size (v0.2).
8. **Parent / children** — `parent` resolves to a plan in the store that lists this slug, and the parent chain has no cycle; a manifest status that
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

## v0.2 additions (additive)

Every form below is optional. A plan that uses none of them is a v0.1 plan and checks exactly as before —
apart from two problems v0.2 removed (`parent <slug> is not an Epic` and `## Children is only for size Epic`).
`node <skill>/scripts/dod-index.mjs --strip-v2` removes every form here and returns the store to the v0.1 grammar,
appending each removed line to `<store>/.strip-v2/<slug>.removed.md` — an earlier strip's lines are never replaced (`--dry-run` prints without writing).

| Form | Shape | Validation | Problem text |
|---|---|---|---|
| `kind:` | frontmatter `kind: feature\|product\|backlog` | optional; absent means `feature`; a `backlog` plan may record `pass` lines before its `→ ready` transition — they count as pre-verified, and `--check` prints `pre-verified n · built m`; on any other kind such a line is a warning | `kind "<v>" must be feature, product or backlog` · warning `evidence before baseline: <Dn> passed before the plan reached ready` |
| `parent:` on any size | frontmatter `parent: <slug>` | the parent may be any plan; it must exist, list this plan under `## Children`, and the chain must not loop | `parent <slug> not found in the store` · `parent <slug> does not list <me> under ## Children` · `parent cycle: <a> → <b> → <a>` |
| Children origin | `- <slug> · planned\|in-progress\|done · baseline\|An` | third field optional (absent = `baseline`); `An` must be an amendment of this plan | `Children: origin <An> does not exist` · `Children: line does not match the grammar` |
| `version` line | Log `- YYYY-MM-DD · version · v<label> · <text>` | label `[A-Za-z0-9][A-Za-z0-9._-]*`, unique per plan; dates non-decreasing; text required | `version <label> is already used` · `version <label> dated before the previous version` · `version <label> has no text` |
| `audit` line | Log `- YYYY-MM-DD · audit · <run-id> · n/m verified · k stale · j unaccounted` | run id `[a-z0-9]{6}`; the same id may repeat (a resumed run) | `audit line does not match the grammar` |
| `## Proposed` | `- P-<n> · <layer or probe> · <proposed change> · <why>` | P-items never count as D-items, coverage, completion or rate; an empty section is valid | `Proposed: line does not match the grammar` |

When an Epic is `done`, each child is checked on its own: `child <slug> has no plan file`, `child <slug> has parent <p>, not <epic>`,
`child <slug> is <status>, not done`, `child <slug> has <n> check problem(s)`. Limits are warnings, never problems: `plan exceeds 1 MB`,
`plan exceeds 500 items`, `line <n> is over 10,000 characters — skipped`. `--check` prints one summary line before the problem list:
`check <slug> · kind <k> · parent <p> · rubric <r> · versions <n> · problems <x> · warnings <y>`.

## Rubric 2 — the accuracy additions

One frontmatter line, `rubric: 2`, turns on everything in this section. Without it a plan is rubric 1 and
checks exactly as before. `--strip-v2` takes the line, the four rubric-2 probes and the two new amendment
kinds back out again (Rollback, below).

**`rubric:`** is optional, `1` or `2`; absent means `1`, and any other value is the problem
`rubric "<v>" must be 1 or 2`. A rubric-2 plan's Coverage denominators, its `coverage_author` totals and its
gating set all come from rubric 2 — 49 probes, and 9 gating probes (rubric 1's seven plus `12.4` and `14.4`).

**Probe map.** Under rubric 2 a Considered row for layers 2–14 maps every probe of that layer, after the
heading segments, separated by `; `:

| 4 | Business rules & invariants | Considered | 5/5 | Business rules & invariants › 4.1 D1; 4.2 D1 D2; 4.3 D2; 4.4 D1; 4.5 prose: no set here is ever empty |

Each entry is `<probe> <Dn>[ <Dn>…]`, or — for a non-gating probe only — `<probe> prose: <reason>` with a
reason of at least 12 characters. The problems are
`layer <n>: probe <p> is not mapped to a D-item or a prose reason`,
`layer <n>: gating probe <p> cannot be answered by prose`,
`layer <n>: prose reason for <p> is shorter than 12 characters` and
`layer <n>: <p> is not a probe of this layer`. A rubric-1 plan still in `draft` gets one warning:
`rubric 1 plan in draft — new plans use rubric: 2 (probe-to-item coverage)`.

**`fails when:`** Every current `test` or `cmd` item names its failing case in the evidence detail —
`· test: export.test.ts (fails when: the export is empty)` — with at least three non-space characters after
the colon, else `D<n>: test/cmd evidence names no failing case — add "fails when: <input>"`. `file` and
`manual` items are not asked, and `## Baseline` lines are never checked.

**Prose control words.** Each sentence of the prose sections (`Purpose & typical use`, `Use cases`,
`Business rules`, `Interfaces`, `Design`, `Security`, `Failure & observability`, `Performance`, `Rollout`
and their sub-headings) that claims a control — enforced, enforces, blocked, blocks, prevented, prevents,
rejected, rejects, refused, refuses, validated, validates, guaranteed, guarantees, fails closed — without
naming a `Dn` gets the warning `prose claims a control without an item: "<text>" (<section>)`. Words inside
backticks are code, not claims. After ten warnings the rest are one line,
`… and <k> more prose-control warnings`. Warnings never block a plan: the reviewer decides.

**Accretion** (any rubric). An item named by five or more amendments is doing too many jobs:
`D<n> is named by <k> amendments — consider splitting it`.

**Amendment kinds.** Six, in every plan whatever its rubric: `discovered` (the plan was wrong or missed
something), `corrected` (a planning decision of your own, reversed — counts in the rate exactly as
`discovered` does), `requested` (new scope, recorded as a plan version), `emergent` (a build finding nobody
could have foreseen — excluded, like `external`), `defect` (the code was wrong and the plan right) and
`external` (the world changed). A `corrected` amendment names a layer or probe, else
`<An>: corrected amendments must name the layer or probe (e.g. 7 or 7.2), got "<layer>"`. An `emergent` one
says what was found — `· finding: <what was found and where>`, at least 12 characters — else
`<An> (emergent) must cite the finding — add "finding: <what was found and where>"`. Under rubric 2 a
`requested` amendment with no `version` Log line on or after its date warns:
`<An> (requested) has no version line on or after <date> — record the scope change as a plan version`.

The `--check` numbers line splits the discovered side into the items the plan had and got wrong and the
ones it never had: `baseline <b> · discovered <a> amendment(s) / <d> design change(s) (wrong <w> · missed <m>)
· corrected <c> · requested <r> · emergent <e> · defect <x> · external <y>`.

**Converged approval.** After three or more review rounds in which every finding was applied and none of
them touched a gating probe, the plan may be approved on the last review instead of a fresh READY one:
`review: codex · converged` (or `subagent · converged`, `human · converged`). `--check` accepts it only
when the latest review is round 3 or later, carries a reviewer coverage line equal to `coverage_reviewer`,
contains the line `EARLIER: all resolved`, has every finding dispositioned `accepted`, has no finding block
naming a gating probe of the plan's rubric, was written by the reviewer named in `review:`, and the Log
carries `- YYYY-MM-DD · note · converged after round <n> — <k> findings applied, none gating` dated on or
after that review. Each condition that fails is its own problem:
`review: <v> but Review <n> is round <n> — convergence needs round 3 or later`,
`review: <v> but Review <n>'s coverage line "<c>" ≠ coverage_reviewer "<cr>"`,
`review: <v> but Review <n> has no line "EARLIER: all resolved"`,
`review: <v> but Review <n> rejected F<f> — convergence needs every finding accepted`,
`review: <v> but Review <n>'s F<f> names gating probe <p> — a gating finding needs a READY review`,
`review: <v> but the Log has no "note · converged after round <n> — <k> findings applied, none gating" dated on/after <date>`,
`review: <v> but Review <n> was by <by>`.

**Rollback.** `--strip-v2` removes the `rubric:` line, takes each rubric-2 probe back out of its Coverage
row (a Considered `n/n` becomes `n-1/n-1`; a Gap row's own list of open probes decides whether the answered
count or only the denominator drops, and a row with nothing left open becomes Considered), recomputes
`coverage_author`, and rewrites `corrected` to `discovered` and `emergent` to `external`. Every removed or
rewritten line is appended to `<store>/.strip-v2/<slug>.removed.md`. One plan approved on a converged review
stops the **whole store**: nothing is written and the first such plan gets the one line
`strip: <slug> has a converged approval — v0.1 needs a READY review; append a human review (review.md) and run --strip-v2 again`.
Give that plan a READY review and run `--strip-v2` again — stripping the others first would only leave a
store v0.1 still could not read.

## Work packages — the `## Work breakdown` section

A plan's items say what done means; the work breakdown says who owns each one. It is one section of flat
lines — the ids carry the nesting, so there is no indentation to get wrong:

```markdown
## Work breakdown
- W1 · **The tree**
- W1.1 · **Rendering and roll-up** · items: D1 D3 D6 · steps: 2, 3
- W1.2 · **Columns and widths** · items: D2 D5 · steps: 3
- W2 · **The exports**
- W2.1 · **Formats and escaping** · items: D7 D8 · steps: 4
```

- A **parent** is `- W<n>[.<m>] · **<title>**` and nothing else. A **leaf** is `- W<n>.<m> · **<title>** ·
  items: <Dn …> · steps: <n, …>`, and must carry both fields, each non-empty. Titles follow the D-item title
  rule: 1–40 characters, no `*` and no `·`.
- `items:` names **current** D-items, separated by single spaces. `steps:` names `## Build plan` step numbers,
  separated by commas. A leaf id is always two levels — a `W<n>` line carrying `items:` is an error, not a
  shorthand.
- The section is **required** at `rubric: 2` for size `L` and `Epic`. A rubric-1 plan of that size gets the
  same sentence as a warning instead, and S and M plans are never asked for one. A plan without the section
  keeps checking exactly as it did before: none of the ownership or growth checks below runs, and the
  `--check` status line says so rather than printing a silent pass.

**What `--check` enforces once the section exists.** Every current item has exactly one leaf owner and every
build step is named by at least one leaf:

| Problem | Means |
|---|---|
| `D<n> is owned by no work package` | an item nobody is building |
| `D<n> is owned by <k> leaf packages (<ids>)` | two owners, so neither is accountable |
| `Build plan step <n> names no work package` | a step outside the breakdown |
| `W<n>.<m> names <id>, which is not an item or a step` | a typo — reported as a typo, so it can never quietly move an item out of the ownership count above |

**Growth.** Every `discovered` or `corrected` amendment that adds an item (`+Dn`) names the leaf the new item
falls under, as ` · package: W<n>.<m>` between `layer:` and the why:

```markdown
- A1 · 2026-09-16 · discovered · +D13 · layer: 7.2 · package: W1.2 · retry racing the original created duplicates
```

Missing it on an adding amendment is the problem `<An> adds <Dn> but names no work package`, and a name that
does not resolve to a leaf of this plan's breakdown is `<An> names package <Wid>, which is not a leaf work
package` — a typo would otherwise move the growth off the package that really grew and print a row for one
that does not exist. A parent id is not accepted: growth lands on the package that holds the items. `--check`'s
numbers line and the `## Report` then carry `grew: W1.2 +3 · W2.1 +1` — each package that gained items,
most-grown first — or `grew: none` when the section exists and nothing grew. A plan with no section has no
`grew:` line at all: nothing grew is an answer, and not having asked is not.

The field is optional everywhere else, so `requested`, `defect`, `emergent` and `external` amendments are
unaffected, and so is every plan written before this section existed.

## ID legend

`legend: D item · A amendment · S assumption · F review finding · P proposal · W work package · n.m layer.probe`

Every id in a plan is a letter and a number. At `dod: 2` each D-item carries a short title, assumptions are
`S-n` (A is for amendments only), and `--check` and `--list` end with the legend line above and `names:` lines
that resolve every id they printed. `--brief` stays one line.

### Titles
A statement may begin with `**<title>** `: 1 to 40 Unicode code points (`Array.from(title).length`, no
normalisation), no `*`, no `·`, no line break, not blank. The title is a label: the Baseline comparison and
the evidence rules read the line without it, so adding, changing or removing a title never needs an
amendment. Word it at the reader's level (audience.md); the statement stays grammar. A statement that begins
`**` without a valid title is `D<n>: title must be 1–40 characters between ** and **`. Frontmatter `dod:` other
than 1 or 2 is `dod "<v>" must be 1 or 2`.

### Untitled items
At `dod: 1` untitled current items are one warning per plan: `<n> untitled item(s) (<ids>) — add titles before --migrate`.
At `dod: 2` each is a problem: `D<n> has no title`. Baseline items never need a title. A message that names
exactly one current item names it `Dn (title)`; lists of ids stay bare and the footer resolves them.

### Assumption ids
At `dod: 2` an assumption line is `- S-n · …`; an `A-n` line there is `Assumptions: A-<n> must be S-<n> under dod: 2`.
At `dod: 1` it is `- A-n · …`; an `S-n` line there is `Assumptions: S-<n> needs dod: 2 — run --migrate`. The
Baseline comparison reads `A-n` and `S-n` as the same id, so a baselined item that names an assumption is
unchanged by a migration.

### Names footer
After the legend line, `names:` lines give each D, A and S id and each `layer <n>` printed above, in order of
first appearance: an item's title or `(untitled)`, an amendment's kind and layer, an assumption's type, a
layer's canonical name; an id the plan does not define (an old id in a Log line or a Baseline copy) is
`(not in this plan)`. Lines are at most 120 columns, broken only between entries. Past 200 names the rest
are counted in one line `… and <n> more`.

### Migrate
`node <skill>/scripts/dod-index.mjs --migrate <slug> [--dry-run]` takes a plan from `dod: 1` to `dod: 2`: sets
`dod: 2`, renames every whole-token `A-n` to `S-n` outside the frontmatter, `## Log`, `## Baseline` and backtick
code spans (a quoted example id is literal text), appends the Log note
`migrated to dod 2 — assumptions renamed A-n → S-n; earlier Log lines and the Baseline keep the old ids` and prints
one `migrate <slug>: <line>` per changed or added line, then `migrate: <slug> — no assumptions to rename; dod: 2 set`
when nothing was renamed. `--migrate --to 1 <slug>` reverses it: `dod: 1`, `S-n` back to `A-n`, every title
removed from the current items, and the latest migration note removed — byte-identical to the plan before
titles were added. A plan baselined at `dod: 2` carries titles (and `S-n`) in its `## Baseline`; `--to 1` removes
those titles and renames `S-n` there too — the one edit ever made to a Baseline, a format conversion the `dod: 2`
comparison already reads as no change — so an older checker, which compares whole lines, accepts the result. The Log prefix `- <date> · note · migrated to dod 2` is reserved: `--to 1` removes the latest
line that starts with it, so do not begin your own Log lines with it. `--strip-v2` runs `--to 1` on every `dod: 2` plan first. The reviews file is never written.

Refusals — exit 1, one line, nothing written, and only the first that applies, in this order:
1. `usage: dod-index.mjs --migrate <slug> [--dry-run] [--to 1|2] [--dir <store>]` — decided from the arguments alone
2. `migrate: needs Node 20 or later (found <version>) — not written` — before any file is read
3. `no plan <slug> in <dir>` — a slug outside the slug grammar, or not in the store listing
4. `migrate: cannot read <path> (<code>) — not written` — the listing or the plan (invalid UTF-8 is `EILSEQ`)
5. `migrate: <path> resolves outside the store — not written` · `migrate: cannot write <path> (<code>)`
6. `migrate: <slug> is already dod <n>`
7. `migrate: <slug> already uses S-<n> — rename it by hand first` — an `S-n` outside code spans in a section the rename touches
8. `migrate: <slug> has check problems — fix them first`
9. `migrate: <slug> has untitled items <ids> — add titles first`

A write that finds the file changed since it was read retries three times, then
`migrate: <slug> changed underneath — not written`; any other write error is `migrate: <slug> failed (<code>) — not written`.
Two runs at once: the plan is migrated once, with one note; usually one run refuses, but both can report success
when both passed the final comparison before either renamed (they wrote the same bytes). An edit that lands before the final comparison is never lost, one
inside the comparison-to-rename window can be (no lock; git is the recovery).

**Compatibility.** An older dod (v0.1) reading a `dod: 2` plan reports each `S-n` line as
`Assumptions: line does not match the grammar` and, once the plan has a Baseline, each titled item as differing
from its Baseline copy (it compares whole lines, titles included); titles otherwise read as statement text.
Keep a store shared with an older install at `dod: 1` until it upgrades, or `--migrate --to 1` each plan.

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
