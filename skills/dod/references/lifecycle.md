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
- `discovered` — the plan should have caught this. **Counts against the prediction rate.** Must name the
  layer whose probe should have caught it; that is how the rubric improves.
- `requested` — the user changed scope or design. Excluded from the rate. Record the user's words.
- `defect` — the implementation was wrong; the plan already covered the behaviour. Excluded.
- `external` — a dependency, platform, or requirement outside the project changed. Excluded.

Ops edit the DoD to match: `+Dn` appends a new item (IDs are never reused), `-Dn` deletes the line,
`~Dn` rewrites the statement or evidence of an existing item — and is the **only** way a baselined line
may change; the script compares every untouched line byte-for-byte with `## Baseline`. Put each
discovery in its own amendment; the rate counts design changes (`+`/`~` ops), so bundling does not help
and only hides which layer missed.

**Re-review.** If `layer:` names a gating probe (2.1, 3.3, 4.4, 6.2, 10.1, 10.3, 14.3) or the ops remove
an item (`-Dn`), set `review: pending` and tell the user a re-review is owed before `close`. A re-review
is a fresh independent review per review.md — redacted current plan, new `## Review n` appended, findings
dispositioned. If it is READY, set `review:` to that reviewer, `coverage_reviewer` to its line, and log
`- <date> · note · re-review An · Review n READY`. It is not a transition and `approve` does not run again;
the plan stays `in-progress` throughout. The script will not allow `done` without a READY review dated
on or after that amendment.

**Materiality — two different questions.** *Is it an amendment?* Anything that adds, removes, or changes
a D-item, or touches a gating probe: yes. Wording, a clarified path: a log line. *Does it reopen review?*
Only a gating-probe amendment or a removal. `+Dn` / `~Dn` are amendments (recorded, counted by the report)
but do not reopen review — otherwise every honest discovery would cost a review round, and the incentive
would be to stop recording them. Labelling a material change "clarification" to protect the rate is the
failure this whole skill exists to prevent — when in doubt, it is an amendment.

## `close <slug>`

1. Run `status` in full. Any unverified item → **not closed**; list them; stop.
2. Epic: every child in `## Children` is `done`; otherwise stop and list.
3. If `review: pending` (a gating-probe or removal amendment re-opened review) → stop; re-review first
   (see `amend`). `approve` is not the answer — the plan is already past `ready`.
4. Show the user every excluded amendment (`requested`, `defect`, `external`) with its `why`. Each one
   they do not confirm becomes `discovered`. Only then compute the rate.
5. Set `closed`, `status → done`, write `## Report`, run `--check <slug>` (must pass), regenerate the index.

Two completion numbers, always both:
- **vs baseline** — `11/12 — D5 removed by A2 (requested)`
- **vs current** — `12/12`

## `report <slug>` — the value of the plan

Written into `## Report` at close; can be run any time for a snapshot.

```
## Report · 2026-09-19
Baseline items            12
Discovered (planning gaps) 1 amendment · 1 design change · probes: 7.2 (1)
Requested scope changes    2    (excluded)
Defects / external         1    (excluded)
Prediction rate            12 / (12 + 1) = 92 %   target ≥ 90 %
Completion                 vs baseline 11/12 (D5 removed by A2 · requested) · vs current 13/13
Review                     codex · 2 rounds · author 14/14 layers · reviewer 14/14 layers
Timeline                   draft 09-14 · ready 09-15 · start 09-15 · done 09-19
Missed probes              7.2 concurrent use — add to docs/dod/profile.md if it recurs
```

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

## Wording — the reader's level

The `why` text of an amendment, the close conversation (the excluded amendments, the rate and what it
means) and the report's missed-probes explanation are worded at the reader's level for the technology
concerned (`references/audience.md`); the amendment line's grammar, the evidence lines and the `## Report`
block are not — they are parsed. `explain An` restates an amendment a level plainer on request.
