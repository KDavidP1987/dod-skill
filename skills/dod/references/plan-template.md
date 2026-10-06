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
recon_commit: 3f2a9c1
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
| `recon_commit` | repo commit the recon read, or `none` | written `commit` before dod 0.3.1, still read; both at once is a problem |
| `coverage_author` | `a/b layers · c/d probes` or `pending` | applicable layers and probes only (N/A excluded); must equal the Coverage table from `ready` on |
| `coverage_reviewer` | same shape or `pending` | must equal the latest READY review's coverage line from `ready` on |
| `review` | `pending` `codex` `subagent` `human` | never `self`; must name the reviewer of the latest READY review; ` · converged` (rubric 2 and 3) and ` · frozen` (rubric 3) are the two ways to approve without one |
| `profile` | `light` `full` — rubric 3, optional | absent: `light` for S, `full` for M, L and Epic, autonomous or not; the owner's choice beats the default (Rubric 3) |
| `risk` | one sentence — rubric 3 | required on a light plan: the risk the owner accepts, at least 12 characters (Rubric 3) |
| `delegate` | a name, or `none` — rubric 3, optional | the person who may answer for the owner; must match the latest `note · owner · delegate · <who>` Log line (Rubric 3 › Owner or delegate) |
| `builder` | a name, or names separated by `,` — rubric 3, optional | who builds the plan; absent: whoever recorded a passing test, cmd, file or host-check line (Rubric 3 › Owner or delegate) |

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

## Components     (required at rubric 3; see "Rubric 3" below)
- C1 · **Invoice export** <a part the product is incomplete without, as a result> · D1 D4
- C2 · **Maintainable code** <statement> · D2 D3

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
1. <step an agent that has never seen this conversation can execute — paths, commands, schemas> · advances C1 · satisfies D1, D3
2. <the step that builds a check runs that check's planted fault in the same step and logs `note · planted · D<n> · …`> · advances C2 · satisfies D2
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
| DoD item | `- [ ] Dn · **title** statement · type: detail` | `type` ∈ `test` `cmd` `file` `manual` (and `host-check` at rubric 3); `[x]` = checked; IDs never reused; the title is required at `dod: 2` (ID legend) |
| Baseline item | same shape, under `## Baseline` | |
| Amendment | `- An · YYYY-MM-DD · kind · ops · layer: L · why` | ids sequential from A1, dates valid and non-decreasing. `kind` ∈ `discovered` `corrected` `requested` `emergent` `defect` `external`. `ops` = space-separated `+Dn` `-Dn` `~Dn`, or `—` for none; `+` may not reuse any ID ever used in this plan. `discovered` must give `L` as a layer (`7`) or probe (`7.2`); others may use `—` |
| Coverage row | `\| n \| Layer \| Considered\|Gap\|N/A \| a/b \| pointer or reason \|` | exactly 15 rows, numbered 1–15 in order, canonical names; `b` **equals** the rubric's probe count for that layer; Considered needs a = b and a pointer that names a real heading (and ≥ 1 D-item for layers 2–14); Gap needs a < b; N/A needs the applicability test as its reason (the script only checks it is there — ≥ 12 chars; the reviewer checks it is true) |
| Gate line | `Gate — acceptance & testability: passed\|failed …` | in `## Coverage` |
| Assumption | `- S-n · validated · statement · source: <…>` · `- S-n · reversible · decision · fallback: <…>` · `- S-n · decision-required · statement` (`A-n` at `dod: 1`) | `validated` without `source:` or `reversible` without `fallback:` is a grammar error |
| Child | `- slug · planned\|in-progress\|done[ · baseline\|An]` | under `## Children`; the origin field is a v0.2 addition |
| Log — transition | `- YYYY-MM-DD · status → <status> · <command>` | exact commands: `draft · plan`, `ready · approve` (optionally `· review: codex`), `in-progress · start`, `in-progress · reopen An` (An exists, dated on/before), `done · close`, `cancelled · cancel · <reason>`, `superseded · supersede · by <slug>` (slug in the store); dates non-decreasing; at rubric 3 also `done · close · partial` (Rubric 3 › Partial close) |
| Log — evidence | `- YYYY-MM-DD · Dn · pass\|fail · type: detail · commit · who` | `type` must equal the item's type; `commit` = repo commit or `none`; `who` = agent or person |
| Log — other | `- YYYY-MM-DD · review skipped — <reason>` · `- YYYY-MM-DD · renamed from <slug>` · `- YYYY-MM-DD · note · <text>` | the only other bullets allowed in `## Log` |
| Log — effort | `- YYYY-MM-DD · note · effort · <W<n>.<m>\|plan> · <m> min\|<h> h <mm> min measured\|estimated · <n> k tokens measured\|estimated` (or `· tokens not recorded`) | a `note`, so `--check` reads it as any note; written by `scripts/dod-effort.mjs` or by hand. The pages read it whole and anchored; the latest line per package wins; a line that does not match is listed under "Effort lines not read" |
| Log — budget | `- YYYY-MM-DD · note · budget · planning <p> % of measured effort` | a `note`, written by `scripts/dod-effort.mjs --budget`; under rubric 3 the latest one past 25 % is a `--check` warning (Rubric 3 › Planning budget) |
| Log — delegate | `- YYYY-MM-DD · note · owner · delegate · <who>\|none` · `- YYYY-MM-DD · note · delegate · <who> · <answer>` | `note`s; under rubric 3 the latest owner line must match `delegate:`, and a delegate answer names the delegate (Rubric 3 › Owner or delegate) |
| Log — method | `- YYYY-MM-DD · note · method · <what changed in how it is built>` | a `note`; a change of method with the promise unchanged, never an amendment and never scored (Rubric 3 › Scoring by the North Star) |

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
   before `done`, and `review: pending` until then; from 2026-10-02 a READY dated the amendment's own day
   counts only when its ` · scope ` names it. `+Dn` and `~Dn` alone do not reopen review — they
   are material to the *plan* (recorded as amendments, counted by the report) but not to the *review*.
6. **Lifecycle** — the Log transitions replay legally: `draft → ready → in-progress → done`;
   `cancelled`/`superseded` from any open state; `done → in-progress` only as `reopen An` citing an
   existing amendment dated on/before it; every transition line carries its exact command (grammar table
   above; a plan approved frozen writes `status → ready · approve · frozen`, valid only with `review: <reviewer> ·
   frozen`); `supersede · by <slug>` names a plan in the store; dates non-decreasing. Frontmatter `status`
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
`child <slug> is <status>, not done`, `child <slug> has <n> check problem(s)`. Limits: `line <n> is over 10,000 characters` is a problem
(the line is parsed as written, not blanked); `plan exceeds 1 MB` and `plan exceeds 500 items` are warnings. `--check` prints one summary
line before the problem list:
`check <slug> · kind <k> · parent <p> · rubric <r> · versions <n> · problems <x> · warnings <y>`.

## Rubric 2 — the accuracy additions

One frontmatter line, `rubric: 2`, turns on everything in this section. Without it a plan is rubric 1 and
checks exactly as before. `--strip-v2` takes the line, the four rubric-2 probes and the two new amendment
kinds back out again (Rollback, below).

**`rubric:`** is optional, `1`, `2` or `3`; absent means `1`, and any other value is the problem
`rubric "<v>" must be 1, 2 or 3`. A rubric-2 plan's Coverage denominators, its `coverage_author` totals and its
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

## Review loop — cap, growth, signal, scope

Four rules read the reviews file (review.md has the procedure; the texts here are the ones the script prints):

- **Round cap.** Reviews are counted in runs: a run starts after a READY review, or at Review 1 when there is
  none. A `codex` or `subagent` review that is the fourth or later of its run needs the owner's Log note
  `- <date> · note · round cap · after Review <k> · owner: <decision>`, optionally ending
  ` · through Review <m>`, where `k` is the review before it (or `m` is at least its number), dated on or after
  Review `k`. Missing, it is a problem while the plan is `draft` or `review: pending` and a warning otherwise; a
  review dated on or before 2026-09-26, when the rule was built, only ever warns. A `human` review never needs a
  note. `--review-prompt` refuses to build the fourth non-human round of a run without the note.
- **Growth.** A review heading may carry ` · plan <bytes> B · <n> items` (the plan's size and item count when the
  prompt was built); `--check` warns when the latest stamped review of the run is more than 50 % larger than
  the first.
- **Stopping signal.** For a run of two or more reviews ending in REVISE, `--check` prints one information line.
  The signal is met when the latest review has no untagged finding, every `blocking` finding quotes a probe,
  none quotes a gating probe and none re-raises a probe a `blocking` finding of the review before quoted. It
  changes no problem, warning or approval.
- **Scope.** `--review-prompt --scope A<n>,…` builds a re-review of named amendments; the heading carries
  ` · scope A<n>,…`. A READY clears the gating or removal amendments its scope names, or all of them when it is
  unscoped — but a READY dated the same day as an amendment dated on or after 2026-10-02 (`SAME_DAY_FROM`)
  clears it only when its scope names it. A `blocking` finding of a scoped review whose probes all lie outside the amendments' `layer:` probes
  is warned about.

The heading's optional fields, in order after the reviewer: `plan commit <sha>` or `plan uncommitted`,
` · plan <bytes> B · <n> items`, ` · files <k> · <12 hex>` (the code-file manifest's hash), ` · prompt <12 hex>`
(the prompt file's hash) and ` · scope A<n>,…`. A child whose rollback reverse-applies its own commits lists each
as `- <date> · note · own commit <sha>`.

Every text, with `<name>` filled in (`<k>` in the refusal is the review before the one refused):

`--check` — the loop (problems, warnings, the information line):

- `Review <n> is round <r> of a run with no READY — log "note · round cap · after Review <k> · owner: <decision>" before it`
- `review growth: Review <a> <x> KB · <i> items → Review <b> <y> KB · <j> items, +<p> % in this run`
- `review loop: <k> rounds since <since> · stopping signal met at Review <n>`
- `review loop: <k> rounds since <since> · stopping signal not met at Review <n> — <reason>`
- `F<f> is untagged`
- `F<f> is blocking and quotes no probe`
- `F<f> quotes gating probe <p>`
- `F<f> re-raises <p> from Review <m>`
- `Review <n> is scoped <id>, which is not an amendment of this plan`
- `Review <n> is scoped <ids>; F<f> is blocking but quotes only <probes>, outside the scope — advisory by the scope rule: disposition it advisory, or rerun unscoped`

`--review-prompt` — refusals and failures:

- `review-prompt: Review <n> would be round <r> of a run with no READY — log "note · round cap · after Review <k> · owner: <decision>" first, or build with --reviewer human`
- `usage: dod-index.mjs --review-prompt <slug> [--reviewer codex|subagent|human] [--scope A<n>,…] [--dir <store>]`
- `review-prompt: no plan <slug> in the store`
- `review-prompt: <slug> has <k> check problem(s) — fix them first`
- `review-prompt: the redacted plan <what> — not written`
- `review-prompt: <id> is not an amendment of <slug>`
- `review-prompt: cannot write <path> (<code>)`
- `review-prompt: <name> was replaced by another run — build again`

`--review-prompt` — the code-file manifest (`no code files:` and one reason per excluded citation):

- `no code files: <reason>`
- `the plan cites none`
- `not a git repository`
- `git timed out after 10 s`
- `git exited <code>`
- `… and <n> more: <reason>`
- `not found`
- `a link`
- `outside the repository`
- `untracked`
- `ignored`
- `in the plan store`
- `refused name`
- `binary`
- `not UTF-8`
- `token-shaped content at line <n>`
- `over budget (<bytes> B, <left> B left)`
- `over the 200-citation cap`

## Calibration

Four additions, all read by `dod-index.mjs`; a v0.1 or v0.2 checker reads each as text it already accepts.

- **Dry-run note** (a Log `note`): `- <date> · note · dry-run · D<n> · <test|cmd>: <code span> → <what it printed>` or
  `- <date> · note · dry-run · D<n> · n/a · <reason of 12 characters or more>`. The command is one Markdown code span —
  a command holding a backtick uses a longer fence — so an arrow inside it never splits the note. In a plan baselined
  on or after 2026-10-02, every `test` and `cmd` item of the Baseline needs one dated on or before `baselined` and
  written before the `status → ready` line (a backlog plan's pass before that line stands in for it). A note never
  verifies an item; the `pass` line does. Write `<home>` or `<tmp>` for a path under the home or temp directory.
  A check built by the plan itself, at a later step, takes the deferred form instead (dod 0.3.5):
  `- <date> · note · dry-run · D<n> · later · step <k> · plants <the failing input it will be given>`. It stands
  before approval like `n/a`; the item's `pass` then needs an observed dry-run note (`test:` or `cmd:`) written after
  the deferred one and before the pass.
- **Miss history**: every probe a discovered or corrected amendment's `layer:` names in two or more done plans,
  plus every `- <n>.<m> · …` row under `profile.md` › `## Project probes`. A plan under the dry-run rule needs, for
  each history probe its Coverage map answers with items, one of those items with a dry-run note that is not `n/a`.
- **Rework field** (an amendment): `- A<n> · <date> · <kind> · <ops> · layer: <x> · [package: W<n>.<m> · ]reworks: A<k> · <why>`
  — this miss corrects an earlier amendment's fix. A discovered or corrected amendment dated from 2026-10-02 names
  its twins (`twins: <other places>`) or its failing input (`fails when: <input>`) in its why.
- **Host** (`profile.md` › `## Host`): `- <name> · <value> · measured <YYYY-MM-DD>`, one row per name.

The texts the script prints (`MESSAGES_CALIBRATION`; `<name>` is filled in):

Dry-run notes (D1, D2, D24, D27):
- dry-run note does not match the grammar: <text>
- dry-run note names <id>, which is not an item of this plan
- <id>'s dry-run note says <type>, but the item's evidence is <itemType>
- <id>'s dry-run n/a reason is shorter than 12 characters
- D<n> has no dry-run note before approval — run its command on the draft and record what it printed, or record why it cannot run yet
- D<n>'s dry-run note carries a home path or an e-mail — write <home> or <tmp> instead

Miss history (D3–D5, D26, D29):
- probe <p> has a miss history (<k> of <n> done plans) and none of its items <ids> has an observed dry run
- probe <p> is a project probe of profile.md and none of its items <ids> has an observed dry run
- coverage <coverage> · miss history: <list>
- coverage <coverage> · miss history: none yet (<n> done plans)
-  · incomplete: <k> file(s) could not be read, see the warnings
- miss history: profile.md unreadable (<code>) — computed from the store only
- miss history: profile.md row is not `- <probe> · …` with a rubric-2 probe — skipped: <text>
- miss history: <name> does not parse — skipped
- miss history: the store changed during this run — rerun for a consistent result

Rework and twins (D6, D9):
- <An> reworks <Ak>, which is not an earlier amendment of this plan
-  · rework <r> of <m>
- <An> names no twins and no failing input — add "twins: <other places>" or "fails when: <input>"

Index and review findings (D8, D10):
- Miss history — done plans: <list>
- Rework — done plans: <r> of <m> misses corrected an earlier amendment.
- <label> — done plans: none yet.
- review findings on miss-history probes: <k> of <n>

Host (D11):
- host: <n> rows · measured <date>
- host: not set
- ✗ host: <reason>
- row is not `- <name> · <value> · measured <YYYY-MM-DD>`: <text>
- <name> is measured "<date>", which is not a valid YYYY-MM-DD
- row name is empty or longer than 40 characters: <text>
- <name> has an empty value
- <name> appears more than once (names compare case-insensitively)
- profile.md ## Host: <reason> — skipped

## Rubric 3 — what done is made of

`rubric: 3` keeps everything rubric 2 asks and adds the rules below. A plan says what the finished product must
accomplish, never how the code does it; the builder chooses the method. Rubric-1 and rubric-2 plans check exactly
as before, even when they carry a `## Components` section.

**`## Components`** (required). One line per part the product is incomplete without, stated as a result:

```
- C<n> · **<title>** <statement> · D<n> D<m> …
```

- every component names at least one D-item that proves it is there;
- every D-item serves at least one component — an item that serves none is either a missing component or not part
  of done;
- every Build plan step names the components it advances: `… · advances C1 C3 · satisfies D2, D5`.

An amendment that adds an item (`+D<n>`) adds it to a component in the same edit. `## Components` is not
`## Baseline`; it changes with the plan.

**Profile.** `profile: light` or `full`. A plan without the line is light when it is S and full otherwise,
planned autonomously or not. A light plan carries `risk:` in its frontmatter, and answers
a probe its brief does not touch in the Coverage probe map as `7.2 not in brief: <reason>` (at least 12
characters), counted as answered. A gating probe or a layer-10 probe (security, privacy) is never answered that way:
it needs a real answer even when the brief is silent. A full plan answers every probe.

**Rounds, then freeze.** A light plan has 2 codex or subagent rounds per run, a full plan 3 (rubric 1 and 2: 3).
After them the plan may be approved with `review: <reviewer> · frozen` on the latest review, a REVISE, with no
owner note, when every finding of that review that carries `blocks:` is accepted as a risk. A finding that
`blocks: outcome` is never frozen: change the plan, or take it to the owner. A plan made autonomously had no owner
in the room, so each frozen risk also needs the owner's or the delegate's Log line,
`- YYYY-MM-DD · note · accept · Review <k> F<f> · <who>`, dated on or after the review:

```
- S-<n> · assumed · risk · <the risk accepted, in the reader's words> · finding: Review <k> F<f>
```

A further codex or subagent round past the profile's cap still needs the owner's round-cap note (Review loop).
Advice on a READY review (a finding with no `blocks:`) is logged, never amended in:
`- YYYY-MM-DD · note · deferred · Review <k> F<f> · <what was suggested>`.

**Probe 11.5, the design bar** (layers.md). When layer 11 is Considered, 11.5 maps to an item that checks a
specific bar (`test:` or `cmd:`) or to a `manual:` item naming its judge (`judge: <who>, against <what>`), or it is
answered in prose when the surface has no bar.

**Reviews** (review.md › Rubric 3). A blocking finding says `blocks: outcome | component | design | limit`; one that
does not is dispositioned `advisory by rule`. Every review carries `missing components: none` or a list, and each
component listed is dispositioned `- M<k> · accepted|rejected · …`. A REVISE left with only advisory findings, and
with every listed component rejected, stands as READY.

**From dod 0.3.5 (probe-fixes).** These bite a rubric-3 plan created on or after the 0.3.5 release, and reviews and
amendments dated on or after it; everything earlier checks as before.

- **The whole and the siblings (probe 4.5).** A Business rules section holds exactly one `whole:` line and one
  `siblings:` line. `whole: <name>` says the parts the plan lists add up to something; an item then reconciles it,
  its `fails when:` naming the unexplained (or unaccounted, unattributed, remainder) share over a stated percentage:
  `(fails when: the unexplained share is over 1 % of the total)`. `whole: none — <reason of 12 characters or more>`
  says nothing adds up. `siblings: <a>, <b>[, …]` names the family of things the same check could apply to (two
  or more names: letters, digits, spaces, hyphens); `siblings: none — <reason>` says there is none.
- **Twins.** An item whose title or statement names some but not all of the declared siblings ends its statement,
  before the evidence, with `· twins: <sibling> D<n>[, <sibling> D<n> …]` — the other siblings and the items that
  check them — or `· twins: none — <reason>`.
- **Field probes.** The field list (`references/field-probes.md`, layers.md › Field probes) is asked like the
  store's own miss history: each field probe the Coverage map answers with items needs one of them observed in a dry
  run before approval. Only the owner waives one: `- S-<n> · assumed · risk · <text> · field: <n.m>` and
  `- YYYY-MM-DD · note · accept · field <n.m> · owner`. A probe in both the profile and the field list is asked once,
  in the profile's words.
- **Misses name the probe.** A `discovered` or `corrected` amendment writes `layer: <n>.<m>`, never a bare layer.
- **A probe that blocks twice.** When blocking findings in two review rounds in a row name the same probe, settle it as
  an assumption naming it (`- S-<n> · reversible · probe <n.m>: … · fallback: …`) instead of another rewrite; the
  next round's review prompt names the probes the last round blocked on.
- **Undeclared families.** Every review carries `undeclared families: none` or the sets, and each set is
  dispositioned `- UF<k> · accepted · <C or D id>` or `- UF<k> · rejected · <reason>` (review.md › Record).

**Release plans.** A plan that publishes a release often promises that no commit after its close commit touches
anything but the plan itself. Write that rule to allow `docs/dod/<slug>.reviews.md` as well as `docs/dod/<slug>.md`:
a re-review after a gating amendment lands in the reviews file, after the close.

**Build freeze.** From the `status → in-progress · start` Log line the plan's promises are frozen:

- an amendment dated on or after `start` that changes no item's statement or `fails when:` text — no `+D<n>`, no
  `-D<n>`, and every `~D<n>` leaves the item as `## Baseline` has it, or ops `—` — is a `--check` problem. Log it
  instead: `- YYYY-MM-DD · note · <what changed>`;
- the amendment set — the amendments after the latest unscoped READY review dated before the newest of them (a
  scoped review covers only the amendments it names, so it never starts a new set) — touching 2 or more work
  packages, or 10 % or more of the baseline items, needs every amendment of the set named by a scoped READY review
  dated on or after it (`· scope A<n>,A<m>`), or an unscoped READY review dated on or after its newest amendment;
- a set touching 25 % or more needs an unscoped READY review dated on or after its newest amendment (a scoped one
  does not count) and a `version` Log line dated on or after its first amendment.

While `review: pending` the owed re-review is a warning; once the plan claims a review, or is done, it is a
problem. The thresholds are starting values (business rule 4.1), revisited once the plan has measured them.

**Planning budget.** Planning and review should cost at most 25 % of a plan's measured effort. Measure it with
`dod-effort.mjs --budget --plan <slug>` (lifecycle.md): it compares the tokens spent from the first plan commit to
the `start` Log line with those spent since, and logs `- YYYY-MM-DD · note · budget · planning <p> % of measured
effort`. Past 25 %, freeze: stop reviewing and build, and accept what is still open as risks (`· assumed · risk`).
`--check` warns from the latest budget note and never reads a session record; with no session records the helper
prints "unmeasured" and nothing blocks. The 25 % is a starting value (business rule 4.1).

**`host-check:` evidence.** An item may cite a check the project already ships instead of a new script:

```
- [ ] D<n> · **<title>** <statement> · host-check: <name> · <command>
```

Prefer it over writing a new script whenever such a check exists — a CI job, a lint, the project's own test
command. Both the name and the command are required; it needs no `fails when:`, because the host check defines its
own failure. The command still follows the show-then-run rule of a `cmd:` item (lifecycle.md): it is shown first and runs only
when it is a recognisable build, test, lint or read-only command; anything else needs the user's yes. Its Log
evidence reads `- YYYY-MM-DD · D<n> · pass · host-check: <name> · <command> · <commit> · <who>`. Rubric 1 and 2 refuse
the type.

**Owner or delegate.** The owner may let one named person answer for them: `delegate: <who>` in the frontmatter.
Only the owner names, replaces or withdraws the delegate, by a Log line the field must match — the latest one wins,
and `none` withdraws:

```
- YYYY-MM-DD · note · owner · delegate · <who>
```

The delegate may answer questions, run hands-on checks and accept work within the plan's risk line; whether an
answer stays within that line is the reviewer's and the owner's call, not the script's. Every answer names who gave
it: a delegate's answer to a question is `- YYYY-MM-DD · note · delegate · <who> · <answer>`, and a check or an
acceptance the delegate performed carries the delegate's name as its evidence `who` — never the bare word
`delegate`. Owner-only steps wait for the owner: an item whose statement or evidence names a payment, a credential
or an irreversible step, or carries `owner-only`, may not be passed by the delegate. Word such an item so the reader
sees why it waits.

The builder never reviews or accepts its own work. The builder is `builder: <who>` when the frontmatter names it
(several names separated by `,`), and otherwise whoever recorded a passing `test`, `cmd`, `file` or `host-check`
line, the delegate excepted. A review by the builder — its reviewer (`codex`, `subagent`, `human`) or the person a
review heading names with `· by <who>` (`## Review 3 · 2026-10-06 · human · by kd · …`) — and a `manual` pass
recorded by the builder are `--check` problems. An owner who runs checks themself sets `builder:`, so their own
acceptances are not read as the builder's. Rubric 1 and 2 ignore `delegate:`, `builder:` and `· by`.

**Partial close.** An item waits on the owner when it is a `manual` item whose evidence says `waiting on the owner`
(`manual: waiting on the owner or their delegate; the Log carries …`). When every unverified item waits on the owner,
`--check` says so, and `close` may record

```
- YYYY-MM-DD · status → done · close · partial
```

The frontmatter says `done`; `--check` prints `done · partial` while an item still waits, and lists the waiting
items beside the rate. The prediction rate counts the verified baseline items only — a baseline item still waiting
is left out of both sides, `(baseline − waiting) ÷ (baseline − waiting + discovered)` — and `## Report` names every
waiting item. Feedback may be sent as at any close. A later `pass` on a waiting item is recorded in the Log like
any evidence, and the item ticked `[x]`: the plan stays done, every reader recomputes the rate from the Log, and
once no item waits the plan reads as complete — `--check` prints plain `done` and a line saying so. Any other
unverified item still blocks the close; rubric 1 and 2 refuse `close · partial` as before.

**Scoring by the North Star.** A rubric-3 `discovered` amendment names the outcome, component, design bar or
completion limit it changes, in its `why`, as a blocking finding carries `blocks:`:

```
- A4 · 2026-09-18 · discovered · +D14 · layer: 9.3 · changes: outcome · double-submit created two exports
```

A change of method alone — how the code or a test rig works, every promise unchanged — is not an amendment but a
Log note, which the prediction rate never reads: `- YYYY-MM-DD · note · method · <what changed in how it is built>`.
`close` shows the owner every method note (lifecycle.md › close), so relabelling a real change as method is seen.

**Switching an old plan.** Rubric 3 is opt-in for a plan written under rubric 2: nothing switches it unless asked.
`node <skill>/scripts/dod-index.mjs --migrate --to 3 <slug> [--dry-run]` switches a rubric-2 plan that is not
closed. It sets `rubric: 3`, adds `profile:` (light for S, full otherwise) and
`risk: TODO — the risk the owner accepts, in one sentence` unless the plan has them, adds a `## Components`
skeleton after `## Definition of Done` unless the plan has the section — one component, its title
`TODO name the parts`, holding every current item until the author splits it into the real parts — and logs
`- YYYY-MM-DD · note · migrate · rubric 2 → 3 · first <r> review(s) and <a> amendment(s) kept under rubric 2 · added <what>`.
No other line changes: `## Baseline`, the items, the evidence, the amendments and the reviews file stay
byte-identical, so the prediction rate is the same after the switch. The reviews and amendments on record at the
switch are history: the rules above on how a review or an amendment is written (`blocks:`, `missing components:`,
`changes:`, the build freeze) judge only those recorded after it. The output prints one `migrate <slug>: <line>`
per line written, then one `migrate <slug>: owes · <problem>` per `--check` problem the switch leaves — the risk
to state, the components to name, every Build plan step that advances no component (steps get no `advances` of
their own), probe 11.5 — or `migrate <slug>: owes nothing — --check passes under rubric 3`. The Log prefix
`note · migrate · rubric 2 → 3` is reserved for that note. Refusals, after the shared ones of `--migrate`
(ID legend › Migrate, 1–5) — exit 1, one line, nothing written: `migrate: <slug> is already rubric 3` ·
`migrate: <slug> is <status> — its score is final, so it stays on rubric <n>` (done, cancelled or superseded) ·
`migrate: <slug> is rubric 1 — only a rubric-2 plan switches to rubric 3; move it to rubric 2 by hand first (plan-template.md · Rubric 2)` ·
`migrate: <slug> has check problems — fix them first`. A plan not switched checks exactly as before.

The texts `--check` prints:

- `a rubric-3 plan needs a ## Components section — the parts the product is incomplete without (plan-template.md › Rubric 3)`
- ``Components: line is not `- C<n> · **title** statement · D<n> …`: <text>``
- `Components: <c> is listed twice`
- `<c> names no D-item — every component is served by at least one item`
- `<c> names <d>, which is not a current item`
- `<d> serves no component — name it on the component it helps complete`
- ``Build plan step <k> names no component it advances — add `advances C<n> …` ``
- `Build plan step <k> advances <c>, which is not a component`
- ``layer 11: probe 11.5 (design bar) maps to <d>, which is neither a check (test or cmd) nor a manual item naming its judge (`judge: <who>`)``
- ``Review <n>: F<f> is blocking but names no `blocks: outcome | component | design | limit` — disposition it `advisory by rule`, or ask the reviewer what would fail``
- ``Review <n> has no `missing components:` line — a rubric-3 review answers it: `missing components: none`, or the list``
- ``Review <n>: missing component M<m> (<name>) has no disposition — `- M<m> · accepted · <change>` or `- M<m> · rejected · <reason>` ``
- `profile "<v>" must be light or full`
- ``a light plan needs a `risk:` line in its frontmatter — the risk the owner accepts, in one sentence of at least 12 characters``
- ``layer <n>: <p> is answered `not in brief`, which only a light plan may do — a full plan answers every probe``
- ``layer <n>: the `not in brief` reason for <p> is shorter than 12 characters``
- ``layer <n>: <p> is a gating or layer-10 probe — it needs a real answer, never `not in brief` ``
- `review: <v> needs rubric: 3`
- `review: <v> but the latest review is not a codex or subagent REVISE to freeze on`
- `review: <v> but Review <n> is non-human round <r> of its run — a <profile> plan freezes after <cap>`
- ``review: <v> but Review <n>'s F<f> blocks and no `· assumed · risk` assumption cites `finding: Review <n> F<f>` ``
- `review: <v> but Review <n> was by <by>`
- `review: <v> but Review <n>'s F<f> blocks an outcome, which is never frozen — change the plan, or take it to the owner`
- ``review: <v> but the plan was made autonomously and Review <n>'s F<f> has no `- YYYY-MM-DD · note · accept · Review <n> F<f> · <who>` from the owner or the delegate``
- `review: <v> but Review <n> has no reviewer coverage line`
- ``<id>: `assumed` needs rubric: 3``
- ``<a> records Review <n> F<f>, an advisory finding of a READY review — log it `note · deferred · Review <n> F<f> · …` instead``
- ``<a> is dated after `start` and changes no item's statement or fails-when — log it `note · <what changed>` instead of amending``
- ``amendment set <ids> after `start` touches <k> of <n> items (<p> %) in <w> work package(s) — a scoped re-review is owed: a READY review dated on/after <date>, scoped to <ids> or unscoped``
- ``amendment set <ids> after `start` touches <k> of <n> items (<p> %) — a full re-review is owed: an unscoped READY review dated on/after <date>; a scoped review does not count``
- ``amendment set <ids> after `start` touches <k> of <n> items (<p> %) — at 25 % the plan also needs a `version` Log line dated on/after <date>``
- ``amendment set <ids> after `start` touches <k> of <n> items (<p> %) in <w> work package(s) — awaiting a <kind> re-review`` (a warning)
- ``<d>: `host-check:` needs `<name> · <command>`, both non-empty — the check the project already ships, then the command that runs it``
- ``<d>: `host-check:` evidence needs rubric: 3``
- ``strip <slug>: rubric 3 — left as written; dod 0.3.2 and earlier refuse it by its rubric, and 0.3.3 reads it again``
- `planning over budget: <slug> logged <p> % (budget <b> %) — freeze the plan and build` (a warning)
- ``delegate: <who> is not what the latest owner Log line names (<last>) — only the owner names or replaces the delegate: `- YYYY-MM-DD · note · owner · delegate · <who>` ``
- ``the owner named delegate <who> on <date> but the frontmatter has no `delegate: <who>` — set it, or log `note · owner · delegate · none` ``
- `<where>: a delegate answer must name who gave it — the plan's delegate is <d>, the line says "<got>"`
- ``<d> is owner-only (a payment, credential or irreversible step, or `owner-only`) but its pass on <date> was recorded by the delegate <who> — it waits for the owner``
- `Review <n> is by <who>, who builds this plan — the builder never reviews its own work`
- `<d> (manual) was accepted on <date> by <who>, who builds this plan — the owner or the delegate accepts it`
- `done · partial: <k> item(s) wait on the owner — <ids>; the prediction rate counts <b> of <n> baseline items` (information)
- `done · partial on <date>: no item waits on the owner any more — the plan reads as complete` (information)
- `done · partial: ## Report does not list waiting item <d>`
- ``every unverified item waits on the owner (<ids>) — `close` may record `status → done · close · partial` `` (information)
- ``<a>: a rubric-3 `discovered` amendment names what it changes — `changes: outcome | component | design | limit`; a change of method alone is a Log note: `note · method · <what changed>` ``
- ``<c> is the skeleton `--migrate --to 3` wrote — split it into the parts the product is incomplete without, each naming its D-items``
- `` `risk:` still reads TODO — state the risk the owner accepts, in one sentence of at least 12 characters ``

From dod 0.3.5 (probe-fixes) — on a rubric-3 plan created, a review dated or an amendment dated on or after the
release — `--check` also prints:

- ``probe <p> is a field probe, missed in <k> of <n> field reports (<sentence>), and none of its items <ids> has an observed dry run — run one, or have the owner accept the risk (`· assumed · risk · … · field: <p>` and `note · accept · field <p> · owner`)``
- `probe <p> is a project probe of profile.md ("<wording>") and a field probe, and none of its items <ids> has an observed dry run`
- ``probe <p> is waived by <s>, but the Log has no `note · accept · field <p> · owner` — only the owner waives a field probe``
- `field probes: references/field-probes.md unreadable (<code>) — the field probes are not asked` (a warning)
- `` Business rules 4.5 has no `whole:` line — write `whole: <the whole the parts add up to>` or `whole: none — <why, 12 characters or more>` ``
- ``Business rules has <k> `whole:` lines — write one``
- `` `whole:` line is not `whole: <name>` or `whole: none — <reason of 12 characters or more>`: <text> ``
- `` `whole: <name>` has no item whose `fails when:` names the unexplained share over a stated percentage (`… the unexplained share is over 1 % …`) ``
- `` Business rules 4.5 has no `siblings:` line — write `siblings: <a>, <b>[, …]` or `siblings: none — <why>` ``
- ``Business rules has <k> `siblings:` lines — write one``
- `` `siblings:` line is not two or more names (letters, digits, spaces, hyphens) split by `,`, or `none — <reason>`: <text> ``
- ``<d> checks <member>, one of the siblings <set>, and has no `twins:` — write `twins: <sibling> D<n>, …` or `twins: none — <why>` before its evidence``
- ``<d>'s `twins:` is not `<sibling> D<n>[, <sibling> D<n> …]` naming declared siblings and this plan's items, or `none — <reason>`: <text>``
- ``<a> is a <kind> amendment naming layer <l>, not a probe — write the probe it missed (`layer: <l>.<m>`)``
- ``probe <p> blocked in Review <a> and Review <b> — settle it as an assumption naming it (`- S-<n> · reversible · probe <p>: … · fallback: …`) instead of another rewrite``
- ``Review <n> has no `undeclared families:` line — a review from dod 0.3.5 on answers it: `undeclared families: none`, or the sets``
- ``Review <n>'s `undeclared families:` line is not `none` or sets of two or more names split by `;`: <text>``
- `` Review <n> names undeclared family <k> (<set>) with no `- UF<k> · accepted · <C or D id>` or `- UF<k> · rejected · <reason>` ``
- `` Review <n>: <text> is not `- UF<k> · accepted · <C or D id>` or `- UF<k> · rejected · <reason>` ``
- ``<d> passes on <date>, but its dry run was deferred to step <k> (plants <plants>) and no observed dry-run note follows the deferral — run the check on its planted input and log `note · dry-run · <d> · <type>: …` before the pass``
- ``` `status → ready · approve · frozen` needs a frozen approval — `review: <reviewer> · frozen` on a rubric-3 plan; otherwise write `status → ready · approve · review: <reviewer>` ```

The texts `--migrate --to 3` writes and prints:

- `migrate · rubric 2 → 3 · first <r> review(s) and <a> amendment(s) kept under rubric 2 · added <what>` (the Log note)
- `migrate: <slug> is <status> — its score is final, so it stays on rubric <n>`
- `migrate: <slug> is already rubric 3`
- `migrate: <slug> is rubric 1 — only a rubric-2 plan switches to rubric 3; move it to rubric 2 by hand first (plan-template.md · Rubric 2)`
- `migrate <slug>: owes · <problem>`
- `migrate <slug>: owes nothing — --check passes under rubric 3`

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
1. `usage: dod-index.mjs --migrate <slug> [--dry-run] [--to 1|2|3] [--dir <store>]` — decided from the arguments alone
2. `migrate: needs Node 20 or later (found <version>) — not written` — before any file is read
3. `no plan <slug> in <dir>` — a slug outside the slug grammar, or not in the store listing
4. `migrate: cannot read <path> (<code>) — not written` — the listing or the plan (invalid UTF-8 is `EILSEQ`)
5. `migrate: <path> resolves outside the store — not written` · `migrate: cannot write <path> (<code>)`
6. `migrate: <slug> is already dod <n>`
7. `migrate: <slug> already uses S-<n> — rename it by hand first` — an `S-n` outside code spans in a section the rename touches
8. `migrate: <slug> has check problems — fix them first`
9. `migrate: <slug> has untitled items <ids> — add titles first`

`--to 3` is not a format conversion but the switch to rubric 3: it shares refusals 1–5, then has its own (Rubric 3 ›
Switching an old plan); it never reads or changes `dod:`.

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
