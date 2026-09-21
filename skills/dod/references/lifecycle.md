# Lifecycle — start, track, amend, close, report

## Closure checklist — all of these, or the plan stays `in-progress`

| # | Check | Enforced by |
|---|---|---|
| 1 | Every current D-item `[x]` with a `pass` line after its last `fail` and after its last amendment | script |
| 2 | `review:` not pending; a READY review dated on/after the last gating-probe or `-Dn` amendment | script |
| 3 | Epic: ≥ 1 child, every declared child `done` | script |
| 4 | `## Report` written; `closed` set; `status → done` logged | script (presence) |
| 5 | Every `requested` / `defect` / `external` amendment shown to the user with its `why` and confirmed as honestly classified | you |
| 6 | Manual evidence was actually performed by the person named as `who`, not inferred | you |

The plan file is the single tracker. Nothing about progress lives anywhere else. Every state change is a
line in `## Log`; the frontmatter `status` must equal the last transition line, and the sequence of
transitions must be legal (plan-template.md invariant 6). Read this file before any lifecycle command.

## Transitions

| From | Command | To | Requires | Writes |
|---|---|---|---|---|
| — | `plan` | `draft` | request; recon; layer pass | plan file, `status → draft` |
| `draft` | `approve` | `ready` | concurrence (review.md); no `decision-required` assumptions; no gating probe open; gate passed | `## Baseline` = frozen copy of DoD; `baselined`, `review`, both coverage fields; `status → ready` |
| `ready` | `start` | `in-progress` | user says work has begun (or the builder is about to begin) | `status → in-progress` |
| `in-progress` | `status` | *(no change)* | — | evidence lines for anything verified; warnings. Does not change lifecycle state or product code; it does run evidence commands and append to the tracker |
| `in-progress` | `amend` | *(no change)* | kind, ops, layer, why | amendment line; DoD edited to match ops; if `layer:` is a gating probe or ops contain `-Dn` → `review: pending` and a re-review is owed (below) |
| `in-progress` | *re-review* | *(no change)* | `review: pending` after such an amendment | a new `## Review n` in the reviews file (review.md); if READY: `review:` and `coverage_reviewer` updated, log `note · re-review An · Review n READY`. **Not a transition; `approve` is never run twice.** |
| `in-progress` | `close` | `done` | every current item `[x]` with a `pass` line; epic: every child `done` | `closed`; `status → done`; `## Report` |
| `draft` `ready` `in-progress` | `cancel` | `cancelled` | one-line reason | `closed`; `status → cancelled · <reason>` |
| any open | `supersede --by <slug>` | `superseded` | replacement plan exists | `closed`; `status → superseded · by <slug>`; tombstone at top of body |
| `done` | `reopen` | `in-progress` | the reason, typed like an amendment (usually `defect` or `discovered`) | **two lines, same date, written together:** the amendment `An` under `## Amendments` (the only time `amend` is legal on a `done` plan) and `status → in-progress · reopen An`; `closed: none` |

No other transitions. `ready` cannot go back to `draft` — amend it instead, which may re-open review.
Every transition line carries its exact command (`plan`, `approve`, `start`, `close`, `cancel · <reason>`,
`supersede · by <slug>`, `reopen An`); the script rejects any other wording. A plan cancelled or
superseded after `approve` keeps its `baselined` date — the baseline is history, not state.
`status` never changes lifecycle state; observation is not evidence that work began.

**Inline plans.** A plan written without a store (the user declined `setup`) has no lifecycle: none of
the commands below apply until the user runs `setup` and the plan is saved as `<store>/<slug>.md`. Say
so when you write an inline plan.

## `start <slug>`

Sets `in-progress`. Tells the builder (whoever is about to write code — this agent, another agent, or the
user) the three rules of building from a DoD plan:
1. Follow `## Build plan`; each step names the D-items it satisfies. Check an item only with evidence.
2. Anything the plan did not foresee is an amendment **before** it is built, typed honestly
   (`discovered` when the plan should have caught it; `requested` when the user changed scope).
3. Do not rewrite `## Baseline`, ever.

## `status [slug]` — verification without state change

Without a slug: list open plans (`ready`, `in-progress`) with `n/m` checked and any warnings.
With a slug, for each D-item:

| Evidence type | What `status` does |
|---|---|
| `test` | Runs the project's test command for that file/name if it is recognisable (`npm test`, `pytest`, `go test`, `cargo test`, `node --test`); records `pass`/`fail` with the summary line |
| `cmd` | Shows the command first. Runs it only if it is a recognisable build/test/lint/read-only command; anything else (writes, network, deploy, `rm`, `curl -X POST`, unknown binaries) is shown and **requires the user's yes**. 5-minute timeout. Output is summarised; secrets are never written to the log |
| `file` | Checks the path exists (and contains the stated text, if given) |
| `manual` | Asks the user to perform the steps and report what they observed; records with `who` = the user |

Then reports:
- `n/m items verified`, the unverified list, and any `[x]` without evidence (**"checked without
  evidence"** — the mark is not removed, but the item is reported as unverified until a `pass` line exists).
- Code that contradicts the plan (a path the Build plan names does not exist; a permission the plan
  requires is absent) → proposed amendment, not silently accepted.
- `dod-index.mjs --check <slug>` invariants (plan-template.md), when Node is available.

`status` never marks `done` and never changes `status:`. It does write evidence lines — that is the
tracker doing its job, not a state change.

## `amend <slug> <kind> <change>`

```
- A4 · 2026-09-18 · discovered · +D14 · layer: 9.3 · double-submit created two exports; needs idempotency key
```
Six kinds, each with one test that decides it:

- `discovered` — *the plan was wrong or missed something.* **Counts against the prediction rate.** Must
  name the layer whose probe should have caught it; that is how the rubric improves.
- `corrected` — *a planning decision of the user's own, reversed during the build.* Counts exactly as
  `discovered` does, and names its layer or probe too: the plan recorded a decision that did not survive
  contact, and the probe that asked for it is where the next plan can ask better.
- `requested` — *new scope the plan was not missing.* Excluded from the rate. Record the user's words,
  and record the change as a `version` line in the Log — under rubric 2 `--check` warns when there is none.
- `emergent` — *a finding nobody could have foreseen at planning time.* Excluded, like `external`. Its
  `why` must carry `· finding: <what was found and where>` — at least 12 characters — so the exclusion is
  auditable at close.
- `defect` — *the code was wrong and the plan right.* Excluded.
- `external` — *the world changed*: a dependency, platform, or requirement outside the project. Excluded.

**An amendment that adds an instrument re-answers its probes.** A check, counter, key or gate added
mid-build is new behaviour, so answer 4.2 (what the rule does with the empty and the boundary case),
4.5 (does "every X" really mean every X) and 12.4 (which failing case proves the check works) for that
instrument — in the amendment's `why`, or in a `- <date> · note · …` line right after it. An idempotency
key with no failing case is exactly the gap the next plan will repeat.

**Accretion.** When five or more amendments name the same item, `--check` warns
`D<n> is named by <k> amendments — consider splitting it`: the item is carrying several jobs and its
evidence can no longer fail for one reason. Split it (`-Dn` plus two `+Dn`) or accept the warning
deliberately — it never blocks a plan.

Ops edit the DoD to match: `+Dn` appends a new item (IDs are never reused), `-Dn` deletes the line,
`~Dn` rewrites the statement or evidence of an existing item — and is the **only** way a baselined line
may change; the script compares every untouched line byte-for-byte with `## Baseline`. Put each
discovery in its own amendment; the rate counts design changes (`+`/`~` ops), so bundling does not help
and only hides which layer missed.

**Re-review.** If `layer:` names a gating probe (2.1, 3.3, 4.4, 6.2, 10.1, 10.3, 14.3 — and, in a
`rubric: 2` plan, 12.4 and 14.4) or the ops remove
an item (`-Dn`), set `review: pending` and tell the user a re-review is owed before `close`. A re-review
is a fresh independent review per review.md — redacted current plan, new `## Review n` appended, findings
dispositioned. Regenerate the review page first (`dod-wbs.mjs --html <slug> --review`) and name its path in
the request, so the reviewer reads the current plan rather than a page left over from the last round. If it is READY, set `review:` to that reviewer, `coverage_reviewer` to its line, and log
`- <date> · note · re-review An · Review n READY`. It is not a transition and `approve` does not run again;
the plan stays `in-progress` throughout. The script will not allow `done` without a READY review dated
on or after that amendment.

**Materiality — two different questions.** *Is it an amendment?* Anything that adds, removes, or changes
a D-item, or touches a gating probe: yes. Wording, a clarified path: a log line. *Does it reopen review?*
Only a gating-probe amendment or a removal. `+Dn` / `~Dn` are amendments (recorded, counted by the report)
but do not reopen review — otherwise every honest discovery would cost a review round, and the incentive
would be to stop recording them. Labelling a material change "clarification" to protect the rate is the
failure this whole skill exists to prevent — when in doubt, it is an amendment.

**A title change is not an amendment.** The `**title**` at the start of a D-item (`dod: 2`, plan-template.md
› ID legend) is a label: the Baseline comparison and the evidence rules read the line without it, so adding,
rewording or removing a title needs no amendment and does not touch the rate. Changing the statement after
it still does.

## `close <slug>`

1. Run `status` in full. Any unverified item → **not closed**; list them; stop.
2. Epic: every child in `## Children` is `done`; otherwise stop and list.
3. If `review: pending` (a gating-probe or removal amendment re-opened review) → stop; re-review first
   (see `amend`). `approve` is not the answer — the plan is already past `ready`.
4. Show the user every excluded amendment (`requested`, `defect`, `external`, `emergent`) with its `why`.
   Each one they do not confirm becomes `discovered`. Ask two questions while you are there:
   - for every `requested` amendment — *"new scope, or a reversal of a decision made while planning?"* A
     reversal is `corrected`, which counts in the rate; only genuinely new scope stays excluded.
   - for every `emergent` amendment — show its `finding:` and ask whether it really could not have been
     foreseen. Unconfirmed, it becomes `discovered`.

   Only then compute the rate.
5. Set `closed`, `status → done`, write `## Report`, run `--check <slug>` (must pass), regenerate the index.
6. **Then the feedback step** — after the report is written, never before, and never as part of it. Run
   `node <skill>/scripts/dod-feedback.mjs --profile --dir <store>` (or read the consent yourself) and act
   on the answer the user gave once, at `setup` (setup.md § 3c):
   - **off** — do nothing, and do not mention it. A store with no entry is off.
   - **review** — run `--draft <slug>`, show the user its output **verbatim**, and wait. On an explicit
     yes, run `--send <slug> --yes --draft-id <id>` with the `draft id:` from the draft you just showed —
     not a recomputed one. Anything but a yes: nothing is sent, and that is the end of it.
   - **auto** — run `--send <slug>` and show its output.

   The close is complete before this step and independent of it: a send that fails prints its line, writes
   its own Log note and changes nothing about the closure. Never pass `--yes` without the user's yes.

Two completion numbers, always both:
- **vs baseline** — `11/12 — D5 removed by A2 (requested)`
- **vs current** — `12/12`

## `report <slug>` — the value of the plan

Written into `## Report` at close; can be run any time for a snapshot.

```
## Report · 2026-09-19
Baseline items            12
Discovered (planning gaps) 1 amendment · 1 design change (wrong 1 · missed 0) · probes: 7.2 (1)
Corrected (reversals)      0            (counts in the rate)
Requested scope changes    2    (excluded)
Emergent / defect / external 0 · 1 · 0  (excluded)
Prediction rate            12 / (12 + 1) = 92 %   target ≥ 90 %
Completion                 vs baseline 11/12 (D5 removed by A2 · requested) · vs current 13/13
Review                     codex · 2 rounds · author 14/14 layers · reviewer 14/14 layers
Timeline                   draft 09-14 · ready 09-15 · start 09-15 · done 09-19
Missed probes              7.2 concurrent use — add to docs/dod/profile.md if it recurs
```

`--check` prints the same numbers on one line:
`baseline <b> · discovered <a> amendment(s) / <d> design change(s) (wrong <w> · missed <m>) · corrected <c>
· requested <r> · emergent <e> · defect <x> · external <y>`. **Wrong** counts the `~Dn` ops — the plan had
the item and got it wrong — and **missed** the `+Dn` ops and amendments with no ops at all: the plan had no
item for that at all. Both are planning gaps; which one dominates says whether the next plan needs better
answers or more probes.

**Prediction rate = baseline ÷ (baseline + discovered design changes).** It answers one question: of
the design that turned out to be needed (excluding scope the user chose to change), how much did the
plan foresee? Target 90–95 %. Below 90 % is not a failure of the builder — it is a finding about the
layer probes, and the missed probes line says which.

`dod-index.mjs` aggregates across `done` plans as Σ baseline ÷ (Σ baseline + Σ discovered) — raw counts,
one rounding — and lists the most-missed layers for done plans (with open plans shown separately as
provisional), so a project can add probes to `profile.md` where its own history says it needs them.
Splitting a behaviour into many baseline items to pad the numerator is visible in the index (item counts
are shown) and is the same dishonesty as mislabelling an amendment.

## Slugs, renames, and the index

- `id` is immutable. To rename: change `slug:` and the filename together; rename `<slug>.reviews.md`;
  update the parent's `## Children` line and every child's `parent:`; add the log line
  `- YYYY-MM-DD · renamed from <old>` (a rename is not an amendment — no design changed); regenerate
  the index. The indexer warns on any
  `parent` or `## Children` entry that no longer resolves.
- `<store>/README.md` is generated (`node <skill>/scripts/dod-index.mjs`) and carries a marker line; do
  not hand-edit it. `--check-index` exits 1 when it is stale. It shows **verified** counts, with
  checked-without-evidence items called out separately.
- **Rollback order for a `dod: 2` store** (returning it to an older dod install): first
  `node <skill>/scripts/dod-index.mjs --migrate --to 1 <slug>` on each `dod: 2` plan — it removes titles,
  renames `S-n` back to `A-n` and sets `dod: 1`, in the `## Baseline` copy too — then `--strip-v2` for the other v0.2 forms (it runs the
  `--to 1` step itself on any plan still at `dod: 2`), then `--check` each plan with the older install.

## Wording — the reader's level

The `why` text of an amendment, the close conversation (the excluded amendments, the rate and what it
means) and the report's missed-probes explanation are worded at the reader's level for the technology
concerned (`references/audience.md`); the amendment line's grammar, the evidence lines and the `## Report`
block are not — they are parsed. `explain An` restates an amendment a level plainer on request.
