# Layers — the consideration rubric

Fifteen scored layers plus one gate. A layer is **Considered** only when every applicable probe under it
is answered in the plan with a pointer to the section that answers it. Otherwise it is a **Gap**. A layer
is **N/A** only with the applicability test that was performed ("no user-facing surface — this is a
nightly job, checked `src/jobs/`"). The reviewer may contest any N/A.

Probes marked **⛔ gating** block `ready` individually, even if the layer's other probes are answered.

**Three rubrics.** rubric 1 = 45 probes and 7 gating. rubric 2 = 49 probes and 9 gating — it adds the four probes
marked `(rubric 2)` below (4.5, 11.4, 12.4 ⛔, 14.4 ⛔). rubric 3 = 50 probes and 9 gating — it adds 11.5, the
design bar, marked `(rubric 3)`, and changes what a review finding may block on (What blocks, below). A plan's
`rubric:` field says which one scores it (absent means 1); new plans are written at `rubric: 3`. The script holds the same numbers in its exported
`RUBRIC` constant, and `--selftest` case `rubric-sync` fails if this file and that constant disagree.

Coverage is reported at both levels over **applicable** layers and probes: `14/14 layers · 42/42
probes` means one three-probe layer was N/A. N/A leaves the denominator; it never inflates the numerator.
N/A is decided **per layer**; probe denominators are fixed (the counts below), so a single probe that
turns out not to apply is *answered* by writing the test you performed in the plan section — it is
counted, not removed. A `reversible` assumption is a decision (with a stated `fallback:`) and may answer
a probe; a `decision-required` assumption is an unknown and leaves its probe a Gap.

**Field probes.** `field-probes.md` lists the probes that real projects missed most often, counted from the
public field reports, each with one sentence on what was missed. Give each one a real answer: an item whose check
you run once on the draft, before approval, with what it printed recorded as a dry-run note. `--check` asks this of
every plan created from dod 0.3.5 on. Your project's own probes in `profile.md` count first: when both lists
name a probe, it is asked once, in your project's words. Only the owner can let a plan skip a field probe, by
accepting the risk in writing.

---

## 1. Purpose & typical use
- 1.1 Who uses it (role, frequency) and the one sentence they would say when they want it.
- 1.2 The job it does for them — the outcome, not the mechanism.
- 1.3 What exists today that it replaces, extends, or must coexist with.

## 2. Actors & permissions
- 2.1 ⛔ Every actor that can reach it (including unauthenticated, service accounts, admins) and what each may do.
- 2.2 What happens on the unauthorized path — silent deny, error, redirect, audit entry.
- 2.3 Ownership: who may see, change, or delete what someone else created, and what happens when ownership changes hands — a holder replaced mid-flight, a closed thing legitimately reopened.

## 3. Inputs, outputs & data
- 3.1 Every input: shape, limits, validation, and the response to invalid input.
- 3.2 Every output and side effect, including what other systems receive.
- 3.3 ⛔ Persistence: what is stored, where, who owns it, how long it is kept, how it is deleted — for every artifact the feature produces, including by-products (logs, working directories, intermediates), and which of them exist only once.
- 3.4 Migration of existing data, if the shape changes.

## 4. Business rules & invariants
- 4.1 Calculations, thresholds, and policies stated precisely enough to write a test from, and which document is authoritative for a threshold stated in two places.
- 4.2 Invariants that must never be violated (uniqueness, ordering, balance, totals).
- 4.3 Temporal rules — time zones, cut-offs, expiry, retroactive changes.
- 4.4 ⛔ Precedence when rules conflict, and who decides an exception.
- 4.5 (rubric 2) “Every X” sets: for every rule of the form “every X”, how X is computed, what valid content the computation misses, who checks the computation — and, when a tool derives X (a grep, a diff, a directory walk), whether that tool can see every member at the moment it runs: a file not yet tracked, a file this build creates, a path the tool excludes. When the X are parts of a whole the user cares about (the lines of an invoice, the hours of a timesheet), ask whether they add up to that whole on real data, what contributes to the whole that is not an X, and where the remainder is shown: answer `whole: <the whole>`, with an item whose `fails when:` names the unexplained share over a stated percentage, or `whole: none — <why>`. When a check is given to one member of a family (one currency of several, one platform of those supported), ask whether each sibling needs it too: answer `siblings: <a, b, …>` or `siblings: none — <why>`, and on each item that checks one member, `twins: <sibling> D<n>, …` or `twins: none — <why>`.

## 5. Internal interfaces
- 5.1 What it reads from other features/modules, with paths or symbols.
- 5.2 What it writes to or changes about other features, and what breaks there if this is wrong.
- 5.3 Shared types, events, schemas or contracts it introduces or alters — each field enumerated against what the code emits or reads, not against the prose that describes it — and count every function, including the ones the platform calls for you (triggers, hooks, callbacks).

## 6. External dependencies & contracts
- 6.1 Every external API, service, package, or vendor it depends on — version, quota, cost — and every input contract sampled across all its record types, not only the ones the feature expects.
- 6.2 ⛔ Behaviour when each dependency is slow, down, rate-limited, or returns garbage, including internal collaborators — sibling agents and your own tools.
- 6.3 Sandbox / test-mode behaviour and how it is kept out of production.

## 7. States & lifecycle
- 7.1 Empty, first-run, loading, partial, and error states.
- 7.2 Concurrent use — two users, two tabs, a retry racing the original — and which of these actors is you: the planner, the orchestrator, the build tooling.
- 7.3 Stale data, cancel, undo, and re-entry after interruption, and what a correction invalidates.

## 8. Minimal stretch
- 8.1 The least a user can do: empty input, one item, defaults only, skipping optional steps.
- 8.2 The feature used once and never again — does anything leak, linger, or nag.

## 9. Maximal stretch
- 9.1 Volume: 100× the expected count, size, or rate — what degrades and how.
- 9.2 Abuse and misuse: hostile input, automation, the clever workaround a power user will try.
- 9.3 Repeated or parallel use of the same action — idempotency, duplicates, double-submit.

## 10. Security & privacy
- 10.1 ⛔ Authorization checked on every path, including indirect ones (jobs, webhooks, exports) — and an allowed program's options that change what runs (`git --upload-pack`, `npm --script-shell`, `node --require`) are the same boundary as the program itself.
- 10.2 Injection and unsafe content on every input that reaches a query, shell, template, or URL.
- 10.3 ⛔ Secrets and credentials: where they live, how they rotate, what must never be logged.
- 10.4 Personal data: what is collected, minimised, exposed in logs or exports, and the audit trail.

## 11. Design & UX  *(N/A when there is no human-facing surface)*
- 11.1 Where it lives in the product and how a user discovers it.
- 11.2 Feedback: progress, success, failure, and empty-result messaging in the product's voice.
- 11.3 Accessibility (keyboard, screen reader, contrast) and small-screen behaviour.
- 11.4 (rubric 2) Activation: how the feature is invoked or activated when nobody asks for it — a trigger, a pointer line, a hook, a schedule — and what shows it was; the should-not-activate cases are unrelated to the feature's purpose, never adjacent to it — an agent that has just finished an adjacent task invokes it for a good reason.
- 11.5 (rubric 3) Design bar: the look and feel done requires, stated as a result, never as the code that produces it. A specific bar (a colour, a theme, a layout, a named component set) is answered by a check that fails without it; a qualitative bar (dynamic, flexible, calm, on-brand) by a manual item naming its judge (`judge: <who>`) and what they judge against. A surface with no bar says so in prose ("no design bar: internal tool, function only").
## 12. Failure handling & observability
- 12.1 What the user sees for each failure class, and what they can do next.
- 12.2 What is logged or measured, with enough context to debug without reproducing.
- 12.3 How you would know in production that it is broken — the alert or the dashboard.
- 12.4 ⛔ (rubric 2) Failing case: for every check the plan introduces, the input that makes it report a failure, the input it must stay silent on, and what it prints on an empty input — which must not read as a pass; one evidence command per gating probe, able to fail for its stated `fails when`; and a selftest fixture spells what the real input spells and plants the state the real run produces, never a corrected copy of either. Each failing input was run once against the real check before approval, with its output recorded (a dry-run note), and every tolerance, threshold and expected output a check uses cites its source: three real runs with their spread, a specification, or a `reversible` assumption with a `fallback:`.
  Scoring (kept off the score-redacted review page, which shows the line above): a failing case never run is a Gap.

## 13. Performance & scale
- 13.1 The latency or throughput budget, and the hot path that decides it — with one measurement taken in the recon spike by the platform's own advisor or profiler, its number quoted.
- 13.2 Limits and pagination — what is bounded and what happens at the bound, the case a limit came from, and the valid case it excludes.

## 14. Rollout & compatibility
- 14.1 How it ships: flag, staged, all at once; who can turn it off.
- 14.2 Backward compatibility with existing clients, data, and integrations.
- 14.3 ⛔ Rollback: the exact steps to undo it, whether they are still possible after data has been written, and the commit range they cover when the change is committed more than once.
- 14.4 ⛔ (rubric 2) Paths walked: every path the change ships, writes or regenerates, found by walking the Build plan step by step — generated indexes, tooling, fixtures, notes, ignored and generated files, the shipped files a release has to touch, the paths a review itself writes (review pages, re-review records) and the plan store itself. Run the paths check once on the draft and list what it finds: ignored and lock files, a sibling plan's paths, a check that needs a later step's output.

## 15. Out of scope
- 15.1 What was explicitly considered and excluded, so a builder does not fill the gap by guessing.
- 15.2 What is deferred to a later item, and the slug or issue it lives in.

---

## What blocks (rubric 3)

A Definition of Done says what the finished product must accomplish, never how the code does it. Under rubric 3
a review finding blocks `ready` only when the product would fail at one of four things, and it says which:

- `blocks: outcome` — something the plan promises would not happen, or would happen wrongly;
- `blocks: component` — a part the product cannot be complete without is missing;
- `blocks: design` — the design bar (11.5) would not be met;
- `blocks: limit` — a limit that defines done would be broken, such as "answers in under 3 seconds".

Everything else is advice: how to code it, how to build a test rig, more tests, more detail on a decision the
plan already makes. The gating probes above still decide whether a layer is Considered; they no longer make a
finding blocking by naming them. A **light** plan (S, M or unattended, unless the owner asks for full) answers a
probe its brief does not touch with `not in brief: <reason>`, gating probes included, and states the risk it
accepts in a `risk:` line (plan-template.md › Rubric 3). Rubric-1 and rubric-2 plans keep their rules unchanged (review.md).

---

## Gate — Acceptance & testability (not scored)

Every layer marked Considered in 2–14 yields **at least one Definition-of-Done item** (`Dn`) with an
evidence type (`test`, `cmd`, `file`, or `manual`), or the plan states in that layer's row why it yields
none. A plan whose layers are all Considered but whose DoD has four items has not passed this gate.

---

## Also consider (applicability list — promoted to a plan section when relevant, never scored)

Compliance and legal (retention law, consent, export controls) · Localisation and time formats ·
Running cost and quotas · Operational ownership (who is paged, runbook) · Documentation and changelog ·
Analytics and success measurement · Decommissioning of what this replaces · Support tooling (how a
support person sees what the user saw).

For each: one line in the plan under `## Also considered` — either what was decided or why it does not
apply. Silence is a Gap for the reviewer to raise.

---

## Sizing heuristic

| Size | Test | Path |
|---|---|---|
| **S** | Touches one module; no schema, auth, data-retention, or external-dependency change; no new user-facing surface | Lite: layer table with probes answered inline, ≤ 3 questions, human review acceptable |
| **M** | Anything not S that is one deliverable feature | Full pass |
| **L** | Multiple modules or a new external dependency or a schema change | Full pass; expect 2 question rounds |
| **Epic** | A product, site, or multi-feature module | Epic plan with a child manifest; each child is its own S/M/L plan |

State the size and the test that produced it in the plan header. The user may override. A change that
is smaller than S (a typo, a one-line fix) does not need this skill — say so and stop.

### Backlog plans

`kind: backlog` is for a slice of work on a system that already exists — the next items off the user's
backlog, not a new feature.
- **Scope is the slice, not the system.** The Definition of Done names what this slice must make true; the
  parts of the system it does not touch are context, not items. Size the slice, not the product.
- **Recon reads the existing system and the user's backlog.** Read the modules the slice touches and the
  backlog entries it comes from (issue, list, ticket). Items that already pass in the existing system are
  verified **at approve time**: record their `pass` lines before the `→ ready` transition — the report counts
  them as pre-verified, apart from the items this build makes pass, so the prediction rate is not inflated.
- **Probes that typically become N/A**, each with the applicability test to write in the row: 1 (the purpose
  is the system's — test: the slice adds no new user or job), 8.2 (one-time use — test: the slice adds no
  first-run or setup path), 11 (design & UX — test: the slice changes no screen, message or command a person
  reads), 15.2 (deferred decisions — test: nothing in the slice was postponed). Anything the slice touches
  is still scored in full.

## Epic plans — how the rubric applies to a composite

An Epic's Definition of Done is its children plus the decisions they all inherit. Scoring an Epic by
leaf-level detail produces a permanent Gap (the detail belongs in the children) or a false Considered
(the epic names the topic without deciding anything). The rule:

- A probe is **Considered** at the epic level when the epic either **states the decision the children
  inherit** (one sentence a child's author can quote: "hooks never execute evidence commands"), or
  **delegates it to a named child with the constraint that child must satisfy** ("`audit` child: stale
  detection is git-only; without git it is skipped and reported").
- A probe that is delegated **without a constraint** ("security is handled per child") is a **Gap**.
- Gating probes (2.1, 3.3, 4.4, 6.2, 10.1, 10.3, 14.3) must be **stated**, never delegated — they are
  precisely the decisions that must not vary between children.
- The acceptance gate for an Epic: every Considered layer 2–14 maps to at least one epic-level D-item
  **or** to a named child whose Definition of Done must contain an item for it (write the child's slug in
  the pointer: `Security › D4 · child: autonomy-hooks`).
- The reviewer scores the epic by this rule and then, when each child is planned, the child's review
  checks that the inherited decisions appear in the child verbatim or by reference. Cross-cutting layers
  (2 permissions, 10 security, 12 failure and observability, 14 rollout) are the ones most often
  delegated without a constraint — contest them first.

## Project profile (`docs/dod/profile.md`, optional)

A project may declare layers or probes that are always N/A ("no human-facing surface anywhere: CLI-only
tool") or add project-specific probes ("10.1 must name the RLS policy"). Each plan must still restate an
inherited N/A with its reason — the profile is a prompt, not an exemption.

The same file carries the `## Audience` section — the reader's level per technology, written once by
`setup` and read by every `plan` (`references/audience.md`). It changes how questions and prose are
worded, never what a layer requires; the probes above are scored exactly the same at every level.

**Project probes and the miss history.** Rows under `## Project probes` are `- <n>.<m> · <what the plan must state>`.
`dod-index.mjs` adds them to the store's miss history: every probe named by the `layer:` of a discovered or
corrected amendment in two or more done plans. `--check` prints the history after its numbers line, the index
carries it as `Miss history — done plans: …`, and a plan approved from 2026-10-02 must show an observed dry run
(not `n/a`) on at least one item that answers each history probe (plan-template.md › Calibration).

**`## Host`.** One row per fact about the machine the checks run on — `- <name> · <value> · measured <YYYY-MM-DD>`
(`platform`, `node`, `git`, `shell` are the usual four), each value copied from a spike run on that host and
quoted in the plan's Log as `note · spike · <command> → <output>`. `--profile` prints `host: <n> rows · measured
<date>` or `host: not set`, and `✗ host: <reason>` for a broken row. Platform and version strings only — never a
user or machine name.
