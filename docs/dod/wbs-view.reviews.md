# Reviews — wbs-view

## Review 1 · 2026-09-19 · codex · plan commit c70705a

F1 `blocking` — Probe `3.1` is unanswered: the plan enumerates inputs but gives no size limits or explicit "unbounded" decision for plan files, strings, store depth, or item counts.
Fix: State each input's accepted shape and bound—or explicitly declare it unbounded—and the exact failure response when a bound is exceeded.

F2 `blocking` — Probe `3.3` is unsupported by a control: interruption may leave a temporary file that "the next run sweeps," but no D-item or evidence command tests interrupted-write cleanup.
Fix: Specify retention and deletion for interrupted temp files and make `node skills/dod/scripts/dod-wbs.mjs --selftest` fail when the next run does not remove one.

F3 `blocking` — Probe `4.4` lacks an effective precedence test: D1 says plans beat the index, but its fixture never supplies a stale conflicting index, so the command can pass while the implementation trusts it.
Fix: Add a stale-index fixture whose conflicting values must be ignored by `node skills/dod/scripts/dod-wbs.mjs --selftest`.

F4 `blocking` — Probe `4.5` is incomplete: the "Every X" analysis covers nodes, probes, and items but omits universal sets claimed for strings, failure classes, plans, paths, and generated-page sections.
Fix: Enumerate every universal claim, define how each set is computed and what it can miss, and map each to the check that detects omissions.

F5 `blocking` — Probe `6.1` is unanswered for the headless browser: its product/version, installation contract, cost/quota assumptions, and supported result contract are unspecified.
Fix: Select and pin the browser/checker, state its installation and cost/quota contract, and define the accepted outputs.

F6 `blocking` — Probe `6.2` is unanswered for Node, filesystem operations, and imported `dod-index.mjs` helpers; calling them "not collaborators" does not decide behavior when they stall, throw, or return malformed data.
Fix: Define timeout/error behavior for each dependency and collaborator, including read/write/rename failures and invalid helper results, with one failing selftest command.

F7 `blocking` — Probe `10.1` is not enforced on every write path: D9 tests a destination that is itself a link but not an ordinary file beneath a symlinked or junction parent, allowing `--out linked-dir/file` to escape the store.
Fix: Require component-by-component real-path/reparse validation and add that parent-link case to `node skills/dod/scripts/dod-wbs.mjs --selftest`.

F8 `blocking` — Probe `10.3` is claimed only in prose: D26 does not fail if code begins reading credential environment variables or emitting their values.
Fix: State the forbidden secret sources and sinks and extend the import/source scan so the selftest fails on credential reads or secret-bearing output.

F9 `blocking` — Probe `11.3` is incomplete: small-screen layout and semantic markup are covered, but keyboard applicability, screen-reader behavior, and a contrast threshold are not decided or evidenced.
Fix: Declare static-page keyboard behavior, required accessible names/structure, and a concrete contrast standard checked by the browser command.

F10 `blocking` — Probe `12.4` covers only D15 and D16 even though D14 and D17 also introduce checks; their reporting, silent, and empty-input cases are not all specified.
Fix: Give every D14–D17 check one failing input, one valid silent input, and an empty-input result that reports "nothing checked" rather than a pass.

F11 `blocking` — Probe `14.3` has no rollback command that exercises the stated rollback: D30 tests old-checker compatibility but never removes the script/rules/files or verifies the post-revert store.
Fix: Provide an executable isolated rollback test that reverts identified changes, handles generated artifacts, and then runs both old and rolled-back checkers.

F12 `blocking` — Probe `14.4` misses shipped paths: D30 introduces a pinned checker under `tests/fixtures`, D20 requires an unnamed checker and retained screenshots, yet Rollout says no fixture changes and names none of those paths.
Fix: Walk every Build-plan step again and list the exact checker, fixture, screenshot/evidence, generated, plan-store, and index paths.

F13 `blocking` — Probe `15.2` names "0.3.0 children" for audit, enhance, and the hook but supplies no required child slug or issue identifier.
Fix: Name the destination slug or issue for each deferred item.

F14 `blocking` — D20 is unverifiable by its `cmd` evidence because both `<slug>` and `<checker>` are unresolved placeholders and the four screenshot paths are unspecified.
Fix: Replace the placeholders with an executable command using a named fixture/plan and checker, and state the four expected evidence paths.

F15 `blocking` — D23's file predicates cannot verify its full claim: the required substrings do not prove that review generation occurs before asking or that the page path is placed beside each question batch.
Fix: Assert complete normative sentences, or add a parser test that fails when either workflow requirement is absent.

F16 `blocking` — D28 is unverifiable by its command: `<each slug>` is not executable, no before-state is captured, warning classes are not compared, and index equivalence is not checked.
Fix: Provide one command that enumerates the store, records baseline diagnostics, runs every check, regenerates the index, and diffs the permitted changes.

F17 `blocking` — D29 cannot verify byte identity: `git status --porcelain` compares names/statuses rather than bytes, and creating `before` then `after` inside the worktree changes the second snapshot.
Fix: Put snapshots outside the repository and compare a content hash/tree digest before and after the validators.

F18 `advisory` — Minimal-stretch scenario: `--export csv` or `md` against an existing but empty store has no explicit contract for whether it creates a header-only file or writes nothing (`7.1`, `8.1`).
Fix: Add the chosen empty-export result to D11 or D27 and its fixture.

F19 `advisory` — Concurrent interruption scenario: killing an export after temp creation but before rename is asserted to be recoverable, yet no Build-plan step implements the promised stale-temp sweep (`7.3`).
Fix: Add sweep behavior to `writeUnderStore` and an interrupted-publication fixture.

F20 `advisory` — S-8 is not cheaply reversible: changing item-weighted progress to package-weighted progress changes the product's headline metric, historical comparisons, exports, and page semantics; adding a flag does not reverse the default.
Fix: Treat the weighting rule as a validated product decision or explicitly preserve the existing default and define the alternative metric's labeling.

F21 `advisory` — S-6 understates reversibility: adding `--out` later changes the HTML command contract, discovery documentation, cleanup behavior, and likely stored links.
Fix: Either decide the HTML destination now or list all affected contracts in the fallback.

F22 `advisory` — S-9 is labelled reversible but says "fallback: none needed," which does not meet the rubric's requirement for a stated fallback.
Fix: Supply a real fallback or relabel it as a settled decision.

F23 `advisory` — `## Also considered` does not address the mandated applicability list: compliance/legal, localisation, running cost, operational ownership, documentation/changelog, analytics, decommissioning, and support tooling are all silent.
Fix: Add one decision or concrete non-applicability test for each required topic.

F24 `advisory` — Blind re-score: Considered layers are 1 (`Purpose & typical use`), 2 (`Design › Permissions`), 5 (`Interfaces › Internal`), 7 (`Design › States`), 8 (`Use cases › Minimal stretch`), 9 (`Use cases › Maximal stretch`), and 13 (`Performance`); layers 3, 4, 6, 10, 11, 12, 14, and 15 are Gaps; no layer qualifies as N/A.
Fix: Resolve the cited probe gaps and update each Coverage row with the actual status and evidence pointer.

7/15 layers · 36/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · Design › Data 3.1 now gives every input its shape, its bound and its response, names the three inputs that are deliberately unbounded, and +D31 (`bounds`) refuses each over-limit input with its own line and exit 1
- F2 · accepted · Design › Data 3.3 states retention for every artifact and by-product; D9 now sweeps any stale `wbs-*.tmp` before a write and its fixture asserts one present before and absent after
- F3 · accepted · D1's fixture now renders a store whose `README.md` contradicts every plan, and the same store with the index deleted, asserting the two renders are identical
- F4 · accepted · Business rules 4.2 now enumerates seven "every X" sets — nodes, probes, items, strings reaching a surface, failure classes, write paths, page sections — each with how it is computed, what it misses and the case that catches an omission
- F5 · accepted · Interfaces › External 6.1 pins Playwright's bundled Chromium to an exact version in `scripts/checks/page-check.mjs`, states it is dev-only, free, offline and installed by the builder, and defines the accepted result as a per-combination verdict plus four PNGs
- F6 · accepted · 6.2 now states behaviour for Chromium, for every filesystem operation (read, write, rename, realpath, a directory that vanishes mid-scan) and for `dod-index.mjs`'s helpers, including an unknown rubric, with the class each produces; the no-retry, no-timeout choice is stated rather than implied
- F7 · accepted · D9 now resolves **every** component of the destination with `realpathSync` and refuses a link anywhere on the path; the fixture gains the junction-parent case and an allowed link whose target is under the store
- F8 · accepted · D26 names the sources (environment, home directory, keychain, process output) and the sinks (network, process argument, generated file) and the scan fails on a second `process.env` read or any `~`, `%APPDATA%` or `.ssh` path; Security 10.3 states the same in prose
- F9 · accepted · Design › UX 11.3 declares static-page keyboard behaviour, the structural requirements a screen reader relies on, and WCAG AA 4.5:1 — every one asserted by D20's command at both widths
- F10 · accepted · D14 and D17 gained explicit reporting, silent and empty inputs, and Failure & observability 12.4 now lists all four checks with their three inputs each
- F11 · accepted · D30 is now a `cmd` — `scripts/checks/rollback-check.mjs` clones, reverts, asserts the paths are gone and the generated files deleted, then runs both checkers; Rollout 14.3 states the three steps and why they are still possible after the files exist
- F12 · accepted · Rollout 14.4 now walks all eleven steps and names the three new checkers, the screenshots and where they are kept, the fixture that is read but not written, the run-time files and the store paths; the contradictory "no fixture changes" sentence is gone
- F13 · accepted · Out of scope 15.2 names `audit`, `enhance`, `autonomy-hooks` and `release-0-2` — all four already rows in the epic's `## Children`
- F14 · accepted · D20 names this plan, `scripts/checks/page-check.mjs` and the four screenshot filenames, and the command is executable as written
- F15 · accepted · D23 is now a `docs-sync` test asserting three whole normative sentences — the ordering, the path in the request, and the path beside a question batch — each asserted to fail when that sentence alone is deleted
- F16 · accepted · D28 is now one command, `scripts/checks/store-diff.mjs --before c70705a`, which captures the before-state, diffs both problem and warning sets and diffs the regenerated index
- F17 · accepted · D29 now compares `git write-tree` hashes plus an untracked-file list, both written outside the repository
- F18 · accepted · an empty store writes a header-only file and the status line `export: 0 plan(s) · header only`, asserted in D7 and D8
- F19 · accepted · the sweep is in build step 4 and in D9's fixture; the finding is the same control as F2
- F20 · accepted · S-8 is now `validated`: it is the denominator `--check`, `--brief` and the report already use, so a package-weighted view would be a second, differently labelled metric in a later child, not a reversal of this one
- F21 · accepted · S-6's fallback is now additive only — the default path never moves — and lists the contracts a move would touch
- F22 · accepted · S-9 now carries a real fallback: delete the file and stop writing it, since nothing reads the generated files
- F23 · rejected · advisory by rule — the mandated list it cites is not in `layers.md`; layer 15's probes are 15.1 and 15.2, both answered at `## Out of scope`, which now names four outright exclusions and four deferrals with their slugs. Two topics it raises are nonetheless answered elsewhere: running cost at Interfaces › External 6.1 (zero — no service, no quota) and documentation at D24
- F24 · accepted · the eight layers it scored Gap are exactly the eight its blocking findings named; each is now answered, and round 2 re-scores blind

## Review 2 · 2026-09-19 · codex · plan commit 2864833

F1 `[blocking]` Probe `3.3` is unanswered for D20’s four PNG artifacts: “kept with the plan’s evidence line” gives neither a storage location nor a retention/deletion rule, and conflicts with the command writing them under `$TMP`.
Fix: Specify their durable path, owner, retention period, and deletion mechanism, then make an evidence command verify that lifecycle.

F2 `[blocking]` Probe `4.4` has conflicting rules with no precedence: D7 preserves CSV newlines while D12 replaces every newline before writing `wbs.csv`; D9 both refuses a link “anywhere on the path” and allows a link whose target remains inside the store.
Fix: State which rule wins for quoted CSV newlines and whether in-store links are allowed, then encode both decisions in the export selftest.

F3 `[blocking]` Probe `6.1` requires dependency versions, but the plan says Playwright will be pinned to an exact version without naming that version; a builder cannot derive the intended dependency contract from the plan.
Fix: Name the exact Playwright package version and the corresponding bundled Chromium revision or declared compatibility rule.

F4 `[blocking]` Probe `14.4` has no evidence command that fails when an undeclared path is shipped, modified, or generated: D28 checks store compatibility, D29 checks validator side effects, and D30 checks only selected rollback paths.
Fix: Add a command that compares the actual changed/generated path set with an explicit allowlist derived from Rollout 4 and fails on any missing or extra path.

F5 `[advisory]` Concurrent exporters can defeat D10: a later run’s “remove every `wbs-*.tmp` older than the run” sweep can delete the first run’s live temporary file before its rename (`7.2`, `9.3`).
Fix: Give temporary files per-run ownership and remove only abandoned files that cannot belong to an active exporter.

Probe re-check:

| Probe | Result | Where |
|---|---|---|
| 3.1 | Answered | Design › Data 1; D27 and D31 define shapes, bounds, validation, and invalid responses. |
| 3.3 | Gap | Design › Data 3 covers shipped files and temporary stores, but not the durable lifecycle of D20’s PNG evidence. |
| 4.4 | Gap | Business rules 4 states tree/index and plan/review precedence, but D7/D12 and D9 contain unresolved conflicts. |
| 4.5 | Answered | Business rules 2 defines each “every X” set, omissions, and corresponding checker. |
| 6.1 | Gap | Interfaces › External 1 covers quota, cost, and contract, but omits the promised exact Playwright version. |
| 6.2 | Answered | Interfaces › External 2 covers Chromium, filesystem, internal helpers, sibling edits, and racing exports. |
| 10.1 | Answered | Security 1; D9 enforces write confinement and D26 verifies the absence of indirect execution paths. |
| 10.3 | Answered | Security 3; D26 names credential sources and sinks and fails on a new source or sink. |
| 11.3 | Answered | Design › UX 3; D5, D20, and D25 cover keyboard use, structure, contrast, and small screens. |
| 12.4 | Answered | Failure & observability 4; D14–D17 each specify reporting, silent, and empty inputs. |
| 14.3 | Answered | Rollout 3 and D30 execute rollback after generated data exists. |
| 14.4 | Gap | Rollout 4 enumerates paths, but no evidence command verifies that enumeration against actual changes. |
| 15.2 | Answered | Out of scope 2 names all four deferrals and their child slugs. |

Layer rescore:

| Layer | Score | Pointer/reason |
|---|---|---|
| 1 | Considered | Purpose & typical use |
| 2 | Considered | Design › Permissions; D9, D22 |
| 3 | Gap | Probe 3.3, F1 |
| 4 | Gap | Probe 4.4, F2 |
| 5 | Considered | Interfaces › Internal; D9, D14, D17, D26, D28 |
| 6 | Gap | Probe 6.1, F3 |
| 7 | Considered | Design › States; D4, D6, D9, D10, D27 |
| 8 | Considered | Use cases › Minimal stretch; D6 |
| 9 | Considered | Use cases › Maximal stretch; D7, D8, D10, D12, D13, D19 |
| 10 | Considered | Security; D7–D9, D12, D19, D26 |
| 11 | Considered | Design › UX; D5, D11, D20, D23–D25, D27 |
| 12 | Considered | Failure & observability; D14–D17, D27, D29 |
| 13 | Considered | Performance; D2, D5, D13 |
| 14 | Gap | Probe 14.4, F4 |
| 15 | Considered | Out of scope |

Gating-control commands:

- `2.1`, `10.1`: `node skills/dod/scripts/dod-wbs.mjs --selftest` — export confinement and indirect-path scans.
- `3.3`: no complete command because D20 evidence retention is unspecified.
- `4.4`: no complete command covering the conflicting CSV and link rules.
- `6.2`: `node skills/dod/scripts/dod-wbs.mjs --selftest`, with D20 dependency failures additionally exercised by `page-check.mjs`.
- `10.3`: `node skills/dod/scripts/dod-wbs.mjs --selftest` — `import-scan`.
- `12.4`: `node skills/dod/scripts/dod-index.mjs --selftest` — work-breakdown report/silent/empty fixtures.
- `14.3`: `node scripts/checks/rollback-check.mjs`.
- `14.4`: no command verifies actual paths against the declared path inventory.

11/15 layers · 45/49 probes

EARLIER: all resolved

VERDICT: REVISE
### Dispositions
- F1 · accepted · Design › Data 3.3 now states the four PNGs are transient build evidence: written only under the `--out` directory, owned by the builder, never committed, deleted with that directory, and the durable record is D20's evidence line. D20's command asserts the four files exist under `--out` and that nothing was written inside the repository
- F2 · accepted · Business rules 4.4 now resolves both conflicts explicitly. D12 wins on every *single-line record* — terminal line, markdown cell, status or progress line — while a quoted CSV field keeps its newline inside the quotes, where RFC 4180 stops it starting a row; D7 and D12 are reworded to say so and the export fixture asserts both halves. D9 refuses **every** link on the path, one whose target is under the store included, and the fixture case that called that "allowed" now asserts it is refused
- F3 · accepted · Interfaces › External 6.1 gives a checkable contract rather than a guessed number: any `playwright` 1.x shipping Chromium 120 or later, resolved once at build time and written as an exact version into `scripts/checks/package.json`, using only API present since 1.30, with D20's evidence line recording the resolved `playwright` and browser versions
- F4 · accepted · +D32 and `scripts/checks/paths-walked.mjs`: it parses Rollout item 4 into an allowlist, compares it with the commits' changed files, the untracked files and what the run-time commands generate in a temp store, and fails on any undeclared path and on any declared repository path nothing touched
- F5 · accepted · D9's temp files are now `wbs-<pid>-<random>.tmp`; a run always removes its own and another run's only when it is more than six hours old, so the sweep cannot delete a live writer's file. The fixture asserts a six-hour-old file is swept and a one-minute-old file is not

## Review 3 · 2026-09-19 · codex · plan commit 3d66455

1. Purpose & typical use — **Considered**: `Purpose & typical use` answers 1.1–1.3.

2. Actors & permissions — **Considered**: `Design › Permissions` answers 2.1–2.3, with D9 and D22 as evidence.

3. Inputs, outputs & data — **Gap**: `Design › Data` answers 3.1, 3.2 and 3.4, but its cleanup claims conflict on 3.3.

4. Business rules & invariants — **Considered**: `Business rules` answers 4.1–4.5. In particular, 4.4 is now answered: rule precedence and the exception authority are explicit, while D1, D4, D7, D9 and D12 exercise the conflicts.

5. Internal interfaces — **Considered**: `Interfaces › Internal` answers 5.1–5.3.

6. External dependencies & contracts — **Gap**: 6.1 is now answered in `Interfaces › External 1`: the admissible Playwright range, exact build-time pin, Chromium floor, supported API subset, cost/quota position and result contract are stated. However, 6.2 remains incomplete for a hung Chromium process.

7. States & lifecycle — **Considered**: `Design › States` answers 7.1–7.3, although the long-running concurrent-temp scenario below merits correction.

8. Minimal stretch — **Considered**: `Use cases › Minimal stretch` answers 8.1–8.2.

9. Maximal stretch — **Considered**: `Use cases › Maximal stretch` answers 9.1–9.3.

10. Security & privacy — **Gap**: `Security` answers 10.2–10.4, but D9 does not enforce its 10.1 authorization/path-containment claim against a link-swap race.

11. Design & UX — **Considered**: `Design › UX` answers 11.1–11.4.

12. Failure handling & observability — **Gap**: `Failure & observability` answers 12.1–12.3, but 12.4 covers only four grammar checks rather than every checker introduced by the plan.

13. Performance & scale — **Considered**: `Performance` answers 13.1–13.2.

14. Rollout & compatibility — **Gap**: `Rollout` answers 14.1–14.3. The new D32 is directionally correct, but 14.4 is not yet answered because its command does not observe every evidence command’s writes.

15. Out of scope — **Considered**: `Out of scope` answers 15.1–15.2.

F1 — **blocking (12.4):** The assertion that this child introduces only four checks excludes `page-check.mjs`, `store-diff.mjs`, `rollback-check.mjs`, `paths-walked.mjs`, and the new `dod-wbs.mjs` checks; D14–D17 therefore cannot prove failing, silent and empty behavior for every introduced check.  
Fix: enumerate every introduced check and give each a failing fixture, a valid silent fixture, and empty-input output that does not read as a pass.

F2 — **blocking (14.4):** D32 claims to inventory every evidence-command write, but its stated command runs only four runtime generation modes; it cannot observe D20’s browser artifacts, D28’s temporary checkout and index output, D29’s four snapshots, D30’s scratch clone, selftest stores, or dependency-installation artifacts.  
Fix: make one evidence command execute or trace every build and evidence command in isolated roots, compare all resulting repository and external paths with typed declarations in Rollout 4, and fail on undeclared or untouched entries.

F3 — **blocking (3.3):** Persistence is contradictory: D9 retains another run’s fresh temp until it is over six hours old, while `Design › Data 3` says the next write removes an interrupted temp; it also says D20 writes nothing in the repository although the stated D20 command generates both HTML files there.  
Fix: state one authoritative lifecycle—fresh foreign temps remain until a post-six-hour sweep—and distinguish page-generation writes from screenshot writes, with evidence checking both scopes separately.

F4 — **blocking (6.2):** The plan says a hung Chromium makes `page-check.mjs` exit non-zero, but specifies no watchdog or deadline and D20 names no command that fails when Chromium launches and then hangs.  
Fix: specify a finite launch/run timeout, its diagnostic and cleanup behavior, and a fixture command that substitutes a hanging collaborator and exits non-zero within that bound.

F5 — **blocking (10.1):** D9 checks path components before writing but leaves a time-of-check/time-of-use window: another actor can replace a checked directory with a link before the temp creation or rename, and the static-link fixtures still pass.  
Fix: perform publication through handles or equivalent no-follow operations anchored to the verified store, and add one evidence command that races a directory replacement and proves no write escapes.

F6 — **advisory (7.2):** A live export lasting longer than six hours can have its temp file deleted by another run’s stale-file sweep, contradicting the claim that a sweep never deletes a live writer’s file.  
Fix: identify live writers independently of file age, or weaken the guarantee and document the recovery behavior.

The three concrete unhandled scenarios are therefore: a hung Chromium collaborator (6.2), a directory changed to a link between validation and publication (10.1), and a still-live export whose temp exceeds the six-hour threshold (7.2).

10/15 layers · 44/49 probes  
EARLIER: round 2 F1, round 2 F4, round 2 F5 outstanding  
VERDICT: REVISE
### Dispositions
- F1 · accepted · Failure & observability 4 now counts **nine** checks, not four: the four `--check` rules plus the five checkers that judge the build. +D33 requires each of the five to carry its own `--selftest` that plants one violation of every assertion it makes, runs a clean input, and runs an empty input that prints `checked 0 <things>` rather than a bare success
- F2 · accepted · Rollout item 4 is now a **typed** inventory (`repo`, `generated`, `session`) and D32 runs each build and evidence command in isolation under a fresh `TMPDIR` and `HOME`, recording what each one creates in the repository, in the store and in the temp roots, and failing on an undeclared path, an untouched declared path or a wrong type
- F3 · accepted · both contradictions removed. The temp-file lifecycle is now stated once — the owning run always removes its file, another run only after six hours — and D20's two write scopes are separated: page generation writes the two HTML files into the store (declared in Rollout 4), the browser run writes exactly the four PNGs under `--out`
- F4 · accepted · `page-check.mjs` now has finite deadlines — 30 s to launch, 30 s per page, 60 s per width-and-theme combination, 180 s overall — after which it kills the browser, removes any partial screenshot, prints `page-check: chromium timed out after <n> s (<stage>)` and exits 1; a hanging-collaborator fixture is part of D33's planted-violation set
- F5 · accepted · in part, with the residual window stated and the owner's decision recorded as S-10. What can be closed portably is closed: the temp file is created `O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW`, the handle's `fstat` device and inode must match a fresh `lstat` of the resolved path, and the rename stays in that verified directory; D9 gains a swap-race case asserting no ordering puts a byte outside the store. The residual window — the parent *directory* replaced between `realpath` and the open — cannot be closed in portable Node, which has no `openat`. Security 10.1 states it and why it is accepted: winning it requires the ability to create a directory in the store's parent, and anyone with that can already rewrite every plan in the store, so the race grants no access it does not already have
- F6 · accepted · the sweep guarantee is now bounded rather than absolute: it cannot reach a writer inside the 5 s performance budget, an export still live after six hours is outside the design, and Design › States 2 states the recovery — the rename fails `ENOENT`, the run prints its class and exits 1 having published nothing, and no partial file is ever visible because publication is the rename

## Review 4 · 2026-09-19 · subagent · plan commit 66df65f

F1 `blocking` · 12.4 ⛔ — D33's evidence command exits 0 whether or not a checker's `--selftest` actually contains a planted-violation, clean and empty case for each assertion: nothing enumerates the assertion set, so a checker written with one happy-path case passes D33; the "every assertion it makes" set is also absent from Business rules 2's seven "every X" sets (4.5).
Fix: each checker exports a named `ASSERTIONS` registry whose `--selftest` iterates it, exits 1 naming any id with no planted violation, and ends with a counts line; add that registry to Business rules 2.

F2 `blocking` · 6.2 ⛔ — the Chromium deadlines, the kill, the partial-screenshot removal and the timeout line are a control claimed only in prose: no evidence command fails if every deadline is deleted.
Fix: a `page-check.mjs --selftest` case driving an injected browser stub that never returns, requiring exit 1 with that exact line inside the bound, and a message-versus-table comparison like D24's for page-check's own lines.

F3 `blocking` · 4.2 — "It never writes a plan file" and "the plan files are read-only to this child" are invariants held only in prose: D9 admits any destination resolving under the store, so `--out docs/dod/wbs-view.md` or `--out <store>/README.md` passes realpath, `O_NOFOLLOW`, the fstat check and the rename, and overwrites a plan or the index with export text.
Fix: refuse an `--out` target that exists and parses as a plan, and the store's `README.md`, with its own class and exit 1; add the case to D9's fixture, the line to D27 and to `references/wbs.md`.

F4 `blocking` · 14.4 ⛔ — the inventory contradicts itself and omits real writes: step 9 creates `scripts/checks/package.json` while the same paragraph asserts "no package manifest changes", and nothing types `package-lock.json`, `node_modules/` or the `ms-playwright` cache, each of which D32 would report as undeclared.
Fix: state whether `scripts/checks/` is an installed package, declare its lockfile, `node_modules` and the browser cache with their types, and delete the "no package manifest" clause.

F5 `blocking` · 6.1 — the record types the pages must render are sampled only as plans shaped like this one: a plan with a layer marked N/A has no numbered answers, so D21 renders every probe of that layer as `no answer` while D22 forbids the string `N/A` anywhere, leaving the reviewer unable to see that an N/A was claimed; no fixture covers an N/A row, a rubric-1 plan or an Epic.
Fix: decide what the redacted page shows for an N/A layer and add an N/A-row plan, a rubric-1 plan and an Epic to D21's and D22's fixtures.

F6 `advisory` — `## Also considered` holds three rejected alternatives instead of the rubric's applicability list; all eight items are silent.

F7 `advisory` — the six-hour stale-temp rule never names the timestamp it reads or the behaviour under clock skew, and Business rules 5 declares "no clock is involved", which it contradicts.

F8 `advisory` — `--export md` writes `wbs.md` into the directory `--wbs` scans, and the plan gives two answers for a non-plan `.md` there: Business rules 2 skips it, D27 exits 1.

F9 `advisory` — D15 does not catch a package line naming an item or step that does not exist, so a typo silently moves an item out of the ownership check.

F10 `advisory` — D32 runs every command under a fresh `HOME`, which is exactly when Playwright cannot find its browser cache.

F11 `advisory` — whether the two HTML pages are committed is never decided, and D32's typed inventory makes the two answers exclusive.

F12 `advisory` — D29 runs `git add -A` twice inside an `&&` chain, leaving the builder's index staged on any failure, and `$TMP` is not set in every shell.

F13 `advisory` — D25 says "in a spreadsheet" without naming one, and D7's apostrophe prefix renders differently in Excel, LibreOffice and Sheets.

F14 `advisory` — Rollout 3's "nothing was written outside the repository" is contradicted by Data 3 and Rollout 4.

F15 `advisory` — D30 and D32 depend on `skills/dod/tests/fixtures/dod-index.v0.1.mjs` existing at b152504, which Rollout 4 does not cite as a read dependency.

11/15 layers · 43/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · each of the five checkers now exports an `ASSERTIONS` registry its `--selftest` iterates, exiting 1 on any id whose planted violation is missing or does not trip and ending with `checked <n> assertions · <n> planted · <n> silent · empty: checked 0 <things>`; the registry is Business rules 2's eighth "every X" set, with what it misses and who checks it
- F2 · accepted · `page-check.mjs`'s registry includes the four deadlines, each planted by an injected browser stub that never returns and requiring exit 1 with the exact timeout line inside the bound; D24's `messages-match-table` now compares the union of both scripts' `MESSAGES` maps against `references/wbs.md`, in both directions
- F3 · accepted · a real hole, and the invariant is now enforced rather than asserted: D9 refuses a destination that exists and parses as a plan, the store's `README.md` or a `*.reviews.md`, with `wbs: <path> is a plan file — exports are never written over plans` and exit 1. The fixture points `--out` at this plan, at the index and at a reviews file and asserts each is byte-identical afterwards, while a non-plan `.md` in the store is still written; the class is in D27 and in `references/wbs.md`
- F4 · accepted · `scripts/checks/` is an installed package — the only one here, nested so the root stays dependency-free and `npm run validate` still runs from a bare checkout. `package.json` and `package-lock.json` are `repo`, `node_modules/` and the `ms-playwright` cache are `session`, and the "no package manifest" clause is gone
- F5 · accepted · an N/A layer now renders as `declared not applicable — <the applicability test, verbatim>` with its probes reading `not applicable`, which is the thing the reviewer must contest, carried without any Status word; D21's and D22's fixtures gain an N/A-row plan, a rubric-1 plan and an Epic with a Children section
- F6 · accepted · `## Also considered` now carries all eight applicability items, one line each, including the ~150 MB Chromium download as the only running cost and the review page as the support-tooling answer. Round 1's F23 raised the same list and was rejected as advisory by rule; two reviewers naming it independently is reason enough to answer it rather than argue the rule twice
- F7 · accepted · the rule now names `lstat` mtime against `Date.now()` and treats an mtime at or after now as fresh, so skew can spare a stale file but never delete a live one; Business rules 5 scopes "no clock" to plan dates and states this as the one exception, with a skewed-mtime case in D9's fixture
- F8 · accepted · the discriminator is YAML front matter: a `*.md` without it is skipped and counted in the status line, while a file that has front matter and fails to parse is D27's failure. Business rules 2 states it
- F9 · accepted · D15 gains a fourth problem, `W<n>.<m> names <id>, which is not an item or a step`, with `items: D99` and `steps: 42` in the fixture
- F10 · accepted · `page-check.mjs` sets `PLAYWRIGHT_BROWSERS_PATH` to a declared `session` directory rather than inheriting `HOME`, and D32 keeps that variable across its isolation
- F11 · accepted · decided: gitignored under `docs/dod/*.html` and regenerated whenever a review needs them, so a page can never be a stale committed artifact; a request that names the path names the command beside it
- F12 · accepted · D29 is now `scripts/checks/tree-identical.mjs`, which takes both snapshots through its own `GIT_INDEX_FILE` outside the worktree, so the builder's index is never staged and nothing needs restoring on failure, and it makes its own temp root instead of trusting a shell variable
- F13 · accepted · Microsoft Excel and LibreOffice Calc, named in D25 and in the `references/wbs.md` checklist
- F14 · accepted · Rollout 3 now separates the repository writes the rollback undoes from the `session` evidence it deliberately leaves alone
- F15 · accepted · confirmed present in the tree at b152504 and now cited in Interfaces 5.1 as a read dependency, with Rollout 4 saying D30 and D32 read it without writing it

## Review 5 · 2026-09-19 · subagent · plan commit 41d3f22

F1 `blocking` · 14.4 ⛔ — the typed inventory contradicts its own taxonomy and its checker: Rollout 4 types `scripts/checks/node_modules/` as `session` while `session` is defined there as "written outside the repository during a build" and D32 exits 1 when "a `session` path turns up inside the repository", so the declared inventory cannot pass `paths-walked.mjs`, and none of the three types actually fits a gitignored directory created inside the worktree.
Fix: add a fourth type for in-repo-but-never-committed paths with `.gitignore` as its proof, or redefine `session` as "never committed" and change D32's rule from "inside the repository" to "tracked or committed"; then restate both definitions identically in Rollout 4 and D32.

F2 `advisory` — D24's `messages-match-table` runs inside `dod-wbs.mjs --selftest` and must read `page-check.mjs`'s exported failure lines, but `page-check.mjs` imports Playwright, which D29 requires `npm run validate` to pass without, so the two items cannot both pass on a machine that has not installed `scripts/checks/`.

F3 `advisory` — D33 and Failure & observability 4 still count "five checkers" and "nine checks" after this revision added `scripts/checks/tree-identical.mjs`, which is named in neither list; the glob in D33's command does cover it, which is why this is not blocking.

F4 `advisory` — the browser-cache directory `PLAYWRIGHT_BROWSERS_PATH` points at is never named, and if a builder places it under the repository it reproduces F1's contradiction on a second path.

F5 `advisory` — D21 renders an N/A layer's applicability test verbatim while D22 asserts the page contains none of the string `N/A`, so a plan whose applicability test itself begins `N/A — …` makes the two unsatisfiable together, and no fixture plants one.

F6 `advisory` — D9 now carries two refusal classes for one path with no stated precedence, and D24 compares the message column byte-for-byte, so `--out ../other-store/plan.md` can print either line and the table can only hold one.

F7 `advisory` — D9's new sentence runs the three messages together with a colon, which reads as one string and is the text D24's comparison is built from.

F8 `advisory` — the front-matter discriminator adds a status-line element (`skipped <n> non-plan file(s)`) that no item asserts, so the skipped count can be dropped without any test noticing.

F9 `advisory` — D15 now reports four problem classes but its own empty case still says "none of the three checks", and Interfaces 2 still says "its three checks".

F10 `advisory` — D10 proves the atomic-publication race only for `--export csv`, while `--html` and `--html --review` write through the same helper into the same store, which is the likelier race now that pages are regenerated per review.

F11 `advisory` — D32 never says whether `.git/` is observed, and three of the checkers invoke git against this repository.

F12 `advisory` — the 11.4 row answers "nothing activates on its own" while D23 installs exactly what the probe calls an activation, so the plan under-claims its own mechanism.

EARLIER: all resolved
14/15 layers · 48/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · a real contradiction I introduced in the last revision. The taxonomy now classifies by what git must say about a path rather than by where it sits: `repo` (tracked at HEAD), `generated` (written into a store at run time — untracked, and gitignored when the store is inside this repository), `ignored` (in the worktree, never tracked, with a `.gitignore` line as its proof) and `session` (resolving outside the worktree). `node_modules/` is `ignored`; D32 judges every path against `git ls-files` and `.gitignore`, and the four definitions are stated in D32 and in Rollout 4 in the same words
- F2 · accepted · each script now checks its own half of the failure-class table against that one table, so nothing imports the other: `dod-wbs.mjs`'s case covers its `MESSAGES`, `page-check.mjs`'s covers its own lines, and a table row belonging to neither fails both. `npm run validate` therefore still passes on a machine that has never installed `scripts/checks/`
- F3 · accepted · six checkers, ten checks, `tree-identical.mjs` named in D33 with its own registry and empty-input line — and D33 now says the `scripts/checks/*.mjs` glob, not the sentence, is the set, so a seventh checker is covered the day it lands
- F4 · accepted · the cache is `<the run's temp root>/ms-playwright`, made by `mkdtempSync`, never derived from `HOME` or the repository, and D32 asserts it resolves outside the worktree
- F5 · accepted · D21 strips a leading Status token (`N/A`, `N/A ·`, `Not applicable:`) from the verbatim test, and D21's and D22's fixtures gain a plan whose applicability test starts with one
- F6 · accepted · D9's three classes are checked in a stated order — outside the store, then link, then plan file — and the first that matches is the one reported, so one destination prints exactly one line and the table holds exactly one row for it
- F7 · accepted · the three classes are three clauses now, each with its message and exit status, in D27's shape
- F8 · accepted · `progress-3-plans` now holds one `.md` without front matter and one generated `wbs.md`, and asserts the status line ends `skipped 2 non-plan file(s)`
- F9 · accepted · four, in D15's empty case and in Interfaces 2
- F10 · accepted · the export fixture gains two `--html` runs racing on one slug and `--html` racing `--html --review`, each asserting a complete page at every intermediate read and no surviving temp file
- F11 · accepted · D32 observes the whole worktree except `.git/` internals, which the checkers legitimately write when they invoke git
- F12 · accepted · the 11.4 row points at D23 for the review page's activation — the pointer lines are the mechanism, the path beside the question batch is what shows it ran — and keeps the explicit no-trigger decision for the tree and the exports; Design › UX 4 says the same

## Review 6 · 2026-09-19 · subagent · plan commit a209ac3

F1 `blocking` · 6.1 — the Playwright contract contradicts itself: External 1 has the builder install Chromium once for the session while D32 and Rollout 4 put `PLAYWRIGHT_BROWSERS_PATH` at a directory "made by `mkdtempSync`" — a new empty directory per invocation, so every `page-check.mjs` run either re-downloads Chromium or dies with "Executable doesn't exist", the precise opposite of the sentence claiming the isolation can neither make it re-download nor make it fail.
Fix: name one session-scoped cache directory outside the worktree, not derived from `HOME`, created once per build session rather than per run, used by the install command and every invocation, stated identically in External 1, D32, Rollout 4 and the running-cost line.

F2 `advisory` — D32's isolation run list does not include `tree-identical.mjs`, so the newest checker's writes are declared in Rollout 4 but observed by nothing — the same drift D33 cured by making the glob the set.

F3 `advisory` — D24 requires that "a row belonging to neither script fails the case", but neither case can decide what belongs to the other script without importing it, which is exactly what the last revision removed.

F4 `advisory` — D21 states the stripping rule for a leading Status token but neither fixture list contains a plan whose applicability test begins with one, so the rule that keeps a forbidden string off the page is untested.

F5 `advisory` — D9 orders its three refusal classes but the fixture cases are not labelled with the class each must print, and under the new order a symlink pointing outside the store reports class (a) while a link whose target is inside reports (b); "refused the same way" no longer distinguishes them.

F6 `advisory` — D11 requires the status line to end `skipped 2 non-plan file(s)` while D7 and D8 assert an exact empty-store line, and nothing says whether the skipped clause is omitted at zero.

F7 `advisory` — Rollout 3(a) and D30 still say the revert removes "the three `scripts/checks/` checkers" after the directory reached five checkers plus two manifests; the step is still correct because D30 asserts the whole directory is gone.

F8 `advisory` — the rollback deletes four generated files but `scripts/checks/node_modules/` is typed `ignored`, so `git revert` leaves it behind on a real machine and step (b) does not mention it; D30 misses this because a scratch clone never installed it.

F9 `advisory` — the four path-type definitions are stated in both D32 and Rollout 4 with no authority named and no check comparing them, unlike every other pair the plan duplicates, and Business rules 3 does not list them.

EARLIER: all resolved
14/15 layers · 48/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · correct, and the contradiction was introduced by the previous round's own fix. The cache is now one fixed directory, `<the OS temp directory>/dod-wbs-browsers`: created if absent, reused if present, never derived from `HOME`, never inside the worktree, used by the install command and by every `page-check.mjs` run alike. External 1 says why it is fixed rather than per-run — a `mkdtempSync` directory would re-download Chromium on every invocation or fail with `Executable doesn't exist` — and D32, Rollout 4 and the running-cost line now name the same path
- F2 · accepted · `paths-walked.mjs` now runs the named plan commands plus **every** `scripts/checks/*.mjs` from the glob, so a checker cannot be declared in the inventory without being observed
- F3 · accepted · the failure-class table gains a script column; each case asserts its own rows exactly, in both directions, and that every other row names a script the document's header lists — which catches an unowned row without either script importing the other
- F4 · accepted · the `review-page` fixture gains a plan whose applicability test reads `N/A — the feature has no external dependency`; D21 asserts the token is stripped and D22 asserts the page still contains no `N/A`
- F5 · accepted · each refused destination in D9's fixture now carries the one class it must print, including the symlink-outside case as (a) and the link-inside case as (b), which is what makes the ordering asserted rather than assumed
- F6 · accepted · the skipped clause appears only when the count is non-zero, which is why the empty-store line stays exactly `export: 0 plan(s) · header only`; both are asserted as exact strings
- F7 · accepted · "everything the child added under `scripts/checks/`" in both places, rather than a count that has now fallen behind twice
- F8 · accepted · Rollout 3(b) now deletes `scripts/checks/node_modules/` too, and says why it must be by hand: `git revert` cannot remove what was never tracked. The browser cache is explicitly left alone, being outside the repository
- F9 · accepted · Business rules 3 names `paths-walked.mjs`'s own definitions authoritative with Rollout 4 as the citation, and the checker parses the type words out of the inventory header and exits 1 if they are not its own four — the same shape as `rubric-sync` for probes and D24 for messages

## Review 7 · 2026-09-20 · codex · plan commit ca2aafa

Independent, score-redacted plan, no prior reviews shown. Reviewer: Codex CLI, read-only. Findings verbatim.

F1 `blocking` — Probe 3.3 lacks an evidence command that fails when transient screenshots, self-test stores, scratch clones, or checker temp roots survive; D20 and D32 observe their creation, while deletion is only promised as “with the session.”
Fix: For 3.3, designate one cleanup command that creates every transient artifact, deletes it at the stated lifecycle boundary, and exits non-zero for each survivor.

F2 `blocking` — Probe 13.2 is unanswered for the 64-character slug, 4,096-character output path, 1 MB file, 500-item, and 10,000-character-line limits: their behavior is stated, but the case each limit came from and the valid case each excludes are not.
Fix: For 13.2, state the source and excluded valid case for every bound, or explicitly remove bounds that have no defensible policy basis.

F3 `blocking` — Probe 14.3 has conflicting rollback contracts: D30 says “delete the four generated files and stop” and “nothing was written outside the repository,” while Rollout 3 additionally deletes `scripts/checks/node_modules/` and intentionally retains browser-cache and session artifacts; `rollback-check.mjs` also has no authoritative manifest of “this child’s commits.”
Fix: For 14.3, specify one authoritative rollback sequence, an exact commit set, every in-repository deletion, and an explicit retain/delete decision for each external artifact, then make `rollback-check.mjs` fail on deviation.

F4 `blocking` — D34 is not verifiable by its stated evidence in the plan’s current `review: pending` state: its command requires `219/219`, but the Log explicitly says the same self-test currently produces `218/218`; this leaves probe 4.5’s discriminator control without a presently passing command.
Fix: For 4.5, make D34’s discriminator test independent of review status and require its own named assertion to pass, rather than relying on a mutable global test count.

F5 `advisory` — Design › Data contradicts amended D31/A9 by saying oversized plans reach D27’s parse failure, while the controlling item says they warn, parse, and render; probe 4.4 has a decision, but the stale competing rule invites the wrong implementation.
Fix: Replace the obsolete Design › Data sentence with A9’s warn-and-render behavior and name D31 as authoritative.

F6 `advisory` — Minimal unauthorized scenario, probe 2.3: `--out <store>/notes.md` may silently overwrite a non-plan file created by another person; the plan explicitly permits this, but provides neither confirmation nor an overwrite flag.
Fix: Record this destructive ownership policy prominently, or require explicit overwrite consent for an existing non-generated target.

F7 `advisory` — Concurrent scenario, probe 7.2: D4 compares file bytes but does not say whether a plan created, deleted, or renamed between directory enumeration and reread is part of the snapshot; only edits to an already-known file are fixtured.
Fix: Define the snapshot’s file-set comparison and add creation, deletion, and rename race cases to `wbs-vs-edit`.

F8 `advisory` — Maximal scenario, probe 9.1: plan count and export rows are declared unbounded, yet evidence stops at 1,000 plans and does not define behavior under memory exhaustion or an impractically large export.
Fix: State graceful resource-exhaustion behavior or introduce a documented operational bound with an override.

F9 `advisory` — Probe 4.5’s “every assertion” computation admits that an assertion omitted from `ASSERTIONS` is detected only by code review, so D33 proves registry entries fire but does not prove the registry is exhaustive.
Fix: Identify the responsible reviewer and review rule explicitly, or derive assertions through a single registration API that makes unregistered checks impossible.

EARLIER: all resolved
12/15 layers · 46/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · amendment A13 (discovered, ~D32, layer 3.3). The finding is right and the fix found two real defects on its first run, which is the test of whether a finding was worth acting on. `paths-walked.mjs` already ran each command alone under a fresh `TMPDIR` and `HOME`; the walk of those roots happens AFTER the command returned, so everything it finds is by definition something that command did not clean up. That walk now fails unless the inventory line carries a third field, the single word `· outlives`. What it caught: `dod-wbs.mjs --selftest` left thirty-odd `mkdtemp` fixture stores standing in the temp root on every run, and `page-check.mjs --selftest` deleted its `out` directory but not the `pages` sibling beside it. Both fixed at the source — one temp registry emptied when `selftest()` returns, and the whole base rather than half of it — not by declaring them intentional. Exactly one path claims `outlives`, Playwright's browser cache, and the plan says plainly that this is the weakest member of the set, because `PLAYWRIGHT_BROWSERS_PATH` pins it to the real temp root (A6) so the isolation never observes it either way: the marker records the decision, it does not prove it
- F2 · accepted · as a LOG LINE and not an amendment: it touches no D-item and no gating probe, which is where this project draws that line. `Design › Data` now states, per bound, where it came from and what valid case it excludes: the slug's 1–64 `[a-z0-9-]` is not a policy but the plan-file naming rule restated, so it excludes only slugs `dod-index.mjs` would refuse to name anyway and widening it on one side would break the pair; `--out`'s 4,096 is Linux's `PATH_MAX`, borrowed because no shorter number could be defended, excluding a valid deeper destination where the filesystem allows one and excluding nothing at all on Windows, where the OS refuses first at 260 — it is a floor that turns an `ENAMETOOLONG` into a named line, not the real limit; and the three plan-file limits are inherited from `dod-index.mjs` rather than chosen here, which is exactly why all three warn. Their excluded case is real — an epic store past 1 MB, a plan past 500 items — and costs one warning line. Whether they should refuse is the epic's `plan-limits` child (A15), because it changes every existing store at once
- F3 · accepted · amendment A12 (discovered, ~D30, layer 14.3). The contradiction is real and was introduced by round 6's own F8 fix, which edited Rollout 3 and left D30 saying the opposite — the same failure mode as F5 below, one document of a pair updated. D30 now owns the sequence and Rollout 3 says in its own text that it is a restatement and which direction changes flow. On the three sub-asks: the exact commit set is now PRINTED as a 42-entry manifest and, better than a manifest, asserted — the reverted worktree must hash to the tree at the base ref, an oracle that does not trust the range that produced it (mutant: comparing against `HEAD^{tree}` fails it with both hashes named). Every in-repository deletion is listed, `node_modules` included, with the reason it must be by hand. The retain/delete decision is now one entry, not the vaguer “session artifacts” the reviewer read: Playwright's browser cache is retained and asserted both outside the worktree and still standing afterwards, and the temp roots left that list because A13 deletes them at their own command's exit, so there is nothing there for a rollback to decide about
- F4 · accepted · amendment A14 (discovered, ~D34, layer 4.5). The reviewer read the Log against the item and found they disagreed about a number, which is the check working. The deeper fault is the one named in the amendment: D34's evidence was a GLOBAL count, and a global count is moved by every assertion anyone adds anywhere. It moved twice in a single session — 219 → 218 when `review: pending` dormanted a converged-plan case, 218 → 219 when D6 gained a zero-item case — neither move having anything to do with the discriminator D34 is about. The evidence now names the two cases that carry the claim and requires each to fail with the name-only filter restored and pass with the discriminator; the total is still printed and no longer asserted
- F5 · accepted · as a LOG LINE: correct, and it is the second half of the same mistake as F3: A9 amended D31 and left the `Design › Data` paragraph that had agreed with the old wording. Rewritten to warn-and-render with D31 named authoritative. Recorded in the Log in its own right, because “the amendment was made and the prose that restated it was not” has now happened twice in two rounds and is worth the project knowing about
- F6 · rejected · the premise is right and the conclusion does not follow. `--out <store>/notes.md` over a stranger's non-plan file is permitted, and `Design › Permissions` 3 says so in as many words. What a confirmation prompt would buy is nothing this child can deliver: there is no interactive session to prompt in — the agent runs the command — and an `--overwrite` flag that an agent passes unconditionally is a ceremony, not a control. The actual protections are already items: the destination cannot leave the store or pass through a link (D9), and a plan, a reviews file or the index is refused by name (D27), which covers every destination whose loss would be unrecoverable. A hand-written note in a plan store is recoverable the same way every other file in a git repository is
- F7 · rejected · on its premise, with one fixture gap accepted as a log line. D4's `same()` compares the snapshot's `bytes` Map by SIZE and KEYS before it compares any content, so a plan created, deleted or renamed between enumeration and reread already changes the key set and already marks the snapshot inconsistent — the reviewer read “compares file bytes” as content-only. Nothing to fix in the design. Accepted in one respect: only an edit to a known file was fixtured, so the property held by accident of the data rather than by test. `wbs-vs-edit` gains create, delete and rename cases
- F8 · rejected · “state graceful behaviour under memory exhaustion” asks for a promise this child cannot keep and must not print. A V8 heap-exhaustion abort is not catchable in the process it happens to; writing “on memory exhaustion it prints X” would be a stated behaviour with no implementation, which is the failure this skill exists to catch, and the Log would carry a claim no case could assert. The unbounded declaration is deliberate and evidenced where evidence is possible: D13 holds 1,000 plans nested five deep inside the budget, and the cost of the alternative — an operational bound with an override — is a refusal on a valid store, which is exactly the class of bound A9 just caught this plan claiming falsely. An operational bound is the epic's `plan-limits` child (A15) if anyone wants one
- F9 · rejected · on its remedy; the admission it quotes is the plan being honest. D34's own text says an assertion written into the code without a registry entry is caught by code review; the reviewer is right that this is weaker than the rest. The proposed cure is worse: a “single registration API that makes unregistered checks impossible” cannot exist in JavaScript — nothing stops a future author writing a bare `if (x) fail()`, and an API that appears to prevent it would be a stated control with no enforcement. Naming a responsible reviewer is not available either: this is one maintainer's lab. What IS enforced, and is what the probe can actually have: every registered assertion must FIRE, and `dod-wbs.mjs --selftest` fails a case registered and never asserted — `0 never asserted` on every run — which catches the far commoner defect of a case that silently stopped checking anything

## Review 8 · 2026-09-20 · codex · plan commit 4bebc2b

Independent, score-redacted plan, no prior reviews shown; the prompt carried only the convergence header (“your earlier findings were F1-F9”) and the request for an `EARLIER:` line. Reviewer: Codex CLI, read-only. Findings verbatim.

F1 `blocking` — Probe 10.1: D9 requires `realpathSync` on the target itself before writing, but a first-run target such as `<store>/wbs.csv` does not exist and therefore cannot be resolved; the stated authorization control and normal-write case cannot both pass.
Fix: Define and test that existing ancestors are resolved and checked, while a nonexistent final component is validated beneath the verified parent and opened with the stated exclusive/no-follow safeguards.

F2 `blocking` — Probe 12.3: “`npm run validate` runs the selftest on every push” has no named hook or CI path, and Rollout 4 explicitly says no CI file changes; D29 proves only a manual invocation, so the plan does not establish how breakage is detected automatically.
Fix: Name the existing push/CI configuration and add an evidence command that fails when the selftest is removed from it, or explicitly choose a manual release/close check as the operational detection mechanism.

F3 `blocking` — Probe 14.3: `git revert <base>..HEAD` identifies every commit after the base, not “this child’s commits”; hashing the result to the base proves that the whole range was removed but cannot prevent rollback from deleting unrelated work committed in that interval.
Fix: Define the exact child-owned commit manifest or another scoped reversal rule, and make `rollback-check.mjs` fail when the selected set contains an unrelated commit or path.

F4 `blocking` — unverifiable D20: On the stated Windows/PowerShell build environment, `--out "$TMP/wbs-pages"` depends on an unspecified `$TMP`; a stranger cannot know the resolved evidence directory or verify the promise that writes occur only there.
Fix: Use a repository-provided portable wrapper that creates and prints an absolute temporary directory, or give platform-specific commands with an explicit existence/resolution check.

EARLIER: unresolved F3
13/15 layers · 47/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · amendment A15 (discovered, ~D9, layer 10.1). Correct and sharply put: the stated control and the ordinary first-run export could not both be true. The code was never wrong — `resolveEvery` walks to the deepest EXISTING component, resolves that with `realpathSync`, and appends the remainder lexically; the final component's no-follow guarantee is carried by `O_CREAT | O_EXCL` at the open and by the `fstat`/`lstat` comparison, both of which D9 already described two clauses later without noticing they were the answer to its own impossible sentence. The item now says what is resolved, what is not, and what carries the guarantee instead. Worth naming: this is the second gating item in this plan that described a component nobody had read (A9 was the first)
- F2 · accepted · amendment A16 (discovered, ~D29, layer 12.3). The claim was false twice over and the reviewer found both halves: `npm run validate` is `validate-skills.mjs`, which validates skill frontmatter and runs no selftest, and the citation `(plan-kinds D20)` pointed at a DIFFERENT PLAN's item. With Rollout 4 also forbidding CI changes, probe 12.3 had a sentence and no mechanism. Taking the reviewer's first branch rather than its second: `.github/workflows/validate.yml` now runs `dod-wbs.mjs --selftest` and `dod-index.mjs --selftest` on every push to `main` and every pull request, which is exactly the two commands of D29 that job was missing. D29's evidence gains a `grep -c` that returns 2, so removing the automatic half fails the item. The five checkers under `scripts/checks/` stay manual — `page-check.mjs` needs an `npm install` and a browser, and they are lab tooling the public release never copies — and that is now written down as a decision instead of an omission
- F3 · accepted · amendment A17 (discovered, ~D30, layer 14.3), and the reviewer was right to mark it `EARLIER: unresolved`. A12 answered “an exact commit set” with the range `<base>..HEAD` plus an assertion that the reverted worktree hashes to the base's tree — which proves the whole range went, and that is the defect rather than the proof. A hand-kept list of hashes would rot within a day. The rule that does not is the inventory this plan already maintains: a commit is this child's exactly when every path it touches is a path Rollout 4 declares. `rollback-check.mjs` now checks that per commit, names the commit, its subject and the offending path, and refuses rather than reverting; the printed manifest is what you then revert one at a time. It reads the block through `paths-walked.mjs`'s own parser so the format keeps one owner. Verified by mutation against the real 44-commit history: dropping `docs/dod/plan-accuracy.md` from the inventory names the two commits that touch it
- F4 · accepted · amendment A18 (discovered, ~D20, layer 6.1). Correct, and the build had already hit this exact trap for real earlier in the session with an empty `$TMPDIR` under Git Bash, which is the strongest possible argument that a stranger would too. `$TMP` is set by neither Windows nor Git Bash, so the command as written resolved to `/wbs-pages` at the filesystem root. Neither of the reviewer's two branches was taken, because a third is better than both: a wrapper is another file to keep in step and platform-specific commands are two commands to keep in step, so `--out` is simply optional now — with it absent `page-check.mjs` creates a directory under the OS temp root and prints the absolute path as its first line. The plan's command names no variable at all, and the reader still learns where the evidence went. The inventory gains `<tmp>/wbs-pages-*` marked `outlives`, since the screenshots are the evidence and keeping them is the point

## Review 9 · 2026-09-20 · codex · plan commit 5540e84

Independent, score-redacted plan, no prior reviews shown; the prompt carried only the convergence header and the request for an `EARLIER:` line. Reviewer: Codex CLI, read-only. Findings verbatim.

F1 `blocking` — Probes **3.3 and 14.4** remain unanswered because screenshot retention conflicts: D32 says exactly one path may `outlives`, but the inventory marks both the browser cache and `<tmp>/wbs-pages-*`; Rollout 3 says every screenshot is deleted before its command returns, while Rollout 4 says screenshots intentionally outlive the run.
Fix: decide whether screenshots persist or are deleted, align D20, D30, D32, Data 3, Rollout 3–4 and the inventory, and make `paths-walked.mjs` fail when the chosen lifecycle is violated.

F2 `blocking` — D29 is unverifiable for probe **12.3**: its stated `cmd` runs only `tree-identical.mjs`; deleting both workflow selftest lines would not fail it because the later `grep` exists only in explanatory prose, so a stranger cannot verify the claimed automatic control.
Fix: include a portable workflow assertion in D29’s executable command, or add it to a named checker, so removing either CI invocation makes that command exit nonzero.

F3 `blocking` — D33 is unverifiable for probe **12.4** on the documented Windows environment because its evidence command is an unnamed POSIX-shell loop (`for …; do …; done`), which PowerShell cannot execute; a stranger cannot run the stated evidence without guessing a shell.
Fix: replace the loop with a cross-platform Node command/checker that discovers `scripts/checks/*.mjs`, runs every selftest, and fails on any missing reporting, silent, or empty case.

F4 `advisory` — S-6 is not genuinely `reversible`: the plan admits that changing the default HTML location would break pasted review links and permits only an additive `--out`, meaning the original default-path decision cannot cheaply be reversed.
Fix: relabel S-6 as validated/committed, or define an actual compatibility-preserving migration and deprecation path.

F5 `advisory` — Blind scoring: layers 1, 2, 4–13 and 15 are Considered by Purpose, Permissions, Business rules, Interfaces, States, Use cases, Security, UX, Failure & observability, Performance and Out of scope respectively; layers 3 and 14 are Gaps because their Data/Rollout lifecycle decisions conflict as described in F1. The three concrete unhandled scenarios are a successful page check leaving screenshots behind (3.3), CI selftest lines being removed while D29 still passes (12.3), and D33 being invoked from PowerShell (12.4).
Fix: resolve F1–F3; the remaining pointers answer their applicable probes, and every Build-plan step cites at least one D-item.

EARLIER: all resolved
13/15 layers · 47/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · amendment A19 (discovered, ~D32, layer 3.3). My own contradiction, introduced in the previous round: A18 marked a second path `outlives` and left D32 saying “exactly one”, while Rollout 3 still said every screenshot is deleted. That is the FOURTH time in this plan an edit was made in one place and not its pair, and A12 was the amendment that was supposed to have cured the habit. The decision, stated once and now in every place that restates it: screenshots PERSIST, and the distinction that makes both halves true is that a SELFTEST's artifacts are working files and are deleted, while a real `page-check.mjs` run's four screenshots are OUTPUT — they are the evidence of the run, and deleting the evidence at the end of the run that produced it would be absurd. `paths-walked.mjs` already fails on any path that violates whichever rule applies, since the `outlives` marker is per line
- F2 · accepted · amendment A20 (discovered, ~D29, layer 12.3). Correct and well aimed: A16 put the CI claim in D29's evidence PROSE while D29's executable command still ran only `tree-identical.mjs`, so deleting both workflow lines would have failed nothing — the same shape of defect as the false claim A16 replaced, one level further in. Taking the reviewer's second branch: `scripts/ci-runs-selftests.mjs` is now one of the commands `tree-identical.mjs` runs for D29. It requires both steps to appear as `- run:` commands rather than merely as text, because matching the bare string would also pass on a commented-out line, and it requires the workflow to still trigger on push and on pull_request, because a step that exists and never fires is the same defect somewhere else. Mutation-verified: deleting one line names it and exits 1
- F3 · accepted · amendment A21 (discovered, ~D33, layer 12.4, which is gating at rubric 2). Unarguable: the plan's own environment is Windows with PowerShell as the default shell, and D33's evidence was a POSIX `for` loop. The reader most likely to run the command could not run it. `scripts/selftest-all.mjs` replaces it — plain Node, the same `scripts/checks/*.mjs` glob rather than a list so a checker added later is run the day it lands, one counts line per suite, and a failure if any suite exits non-zero OR passes without printing a counts line, which is the “missing reporting case” half of the reviewer's fix. It lives outside `scripts/checks/` because `paths-walked.mjs` runs everything in that directory and would otherwise hand the runner to itself
- F4 · accepted · as a change to `## Assumptions` and a log line, since it touches no D-item and no gating probe. The reviewer is right and the plan's own words convicted it: a fallback of “add `--out` and keep this as the default” is an ADDITION beside the decision, not a reversal of it. There is no `committed` type in this grammar, so S-6 is now `validated` with a real source — three documents fix that path (D18 and D21 name it, `references/wbs.md` documents it, and the pointer `review.md` installs pastes it into requests humans keep) and D23's `docs-sync` case checks them against the code
- F5 · accepted · the blind scoring is the reviewer's own and is recorded as given; its three named scenarios are F1, F2 and F3 and are resolved by A19, A20 and A21. Noted for the close report: the two Gap layers, 3 and 14, are both consequences of the single lifecycle contradiction in F1, so one amendment closes both

## Review 10 · 2026-09-20 · codex · plan commit 873e431

Independent, score-redacted plan, no prior reviews shown; the prompt carried the convergence header and the request for an `EARLIER:` line. Reviewer: Codex CLI, read-only. Findings verbatim.

F1 `blocking` — Probe **3.3** remains unanswered for real-run screenshots: D20 and D32 deliberately leave `<tmp>/wbs-pages-*` behind, while Design says it is deleted at session end and D30's rollback neither deletes nor permits it; no evidence command fails when that cleanup is absent.
Fix: Choose one lifecycle—retain with an explicit retention rule, or add executable session/rollback cleanup whose evidence command fails when the screenshot directory survives.

F2 `blocking` — Probe **4.5** is unanswered for “every checker”: the computed set excludes `scripts/selftest-all.mjs` and `scripts/ci-runs-selftests.mjs`, although both enforce assertions, and neither receives D33's planted-violation, silent, and empty-input treatment.
Fix: Compute the checker set from all checker/runner entry points and require D33-style selftests for both scripts, or state and test a principled constraint that excludes them.

F3 `blocking` — Probe **14.3** remains unsafe because rollback classifies a whole commit as this child's whenever all touched pathnames appear in the inventory; an unrelated concurrent commit editing only `docs/dod/README.md` or another shared declared file is therefore reverted as this child's work.
Fix: Define child ownership at commit or patch granularity and make `rollback-check.mjs` refuse any commit containing changes not attributable to this child.

F4 `blocking` — Probe **14.4** is unanswered because D32 claims to observe every build and evidence command but its executable walk covers selected WBS commands and `scripts/checks/*.mjs`, omitting commands such as `npm run validate`, `claude plugin validate`, `scripts/selftest-all.mjs`, `scripts/ci-runs-selftests.mjs`, and the complete D34 command chain.
Fix: Derive the executed command inventory mechanically from all Build-plan and D-item evidence commands, then make `paths-walked.mjs` fail when any declared command is unobserved.

F5 `advisory` — Probe **3.2** is ultimately answered, but Design › Data says the only outputs are stdout, stderr, and four store files even though D20 also produces four external screenshot files.
Fix: Reconcile the output summary with D20's screenshot outputs and their chosen lifecycle.

EARLIER: unresolved F1
12/15 layers · 45/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · amendment A22 (discovered, ~D20, layer 3.3). Verified before accepting, and the reviewer undercounted: A19 stated the persist decision in D32, Rollout 3 and the inventory and left it contradicted in FOUR more places — Design › Data 2 (“Nothing else receives anything”), Data 3 (“the four generated files are the only artifacts”), the persistence paragraph (the screenshots “are deleted with that directory at the end of the build session”, and written under “the `--out` directory the builder passes”, which A14 had already made optional) and D30 (“Exactly ONE thing outside the repository is deliberately RETAINED”). That is the FIFTH round in which an edit landed in one document of a set and not the rest, and the first in which the reviewer reported `EARLIER: unresolved`. The sweep is complete this time and the count is stated: six places name this lifecycle, they are listed in A22, and the recurrence itself is now a finding about the method rather than about any one of them
- F2 · accepted · amendment A23 (discovered, ~D33, layer 4.5). Correct, and it is the same drift one level further on: A8 amended D33 to define “every checker” as six things of two kinds, A21 then added two more scripts that enforce assertions, and the definition was not re-derived. Neither new script had a `--selftest` of its own — verified by reading both files, not by inference. Taking the reviewer's first branch rather than the exemption branch: both now carry an `ASSERTIONS` registry and the plant / silent / empty triple, because a runner that decides whether every other suite passed is exactly the kind of code whose own silence is expensive. `selftest-all.mjs` stays out of `paths-walked.mjs`'s command list for the stated reason (A21) — that is an observation exemption, not a selftest exemption, and the two are now distinguished in D33
- F3 · accepted · the defect is real and it is the second of its class in this plan. Verified concretely: the inventory declares 23 `repo` paths, of which `docs/dod/README.md`, `docs/dod/dod-v0-2.md`, `docs/dod/plan-accuracy.md`, `skills/dod/SKILL.md` and `.gitignore` are SHARED — the `release-0-2` child edits `SKILL.md` and `.gitignore`, and every child regenerates `README.md`. A concurrent commit touching only those would satisfy “every path it touches is declared” and be reverted as this child's work. Round 7 found the first rollback-destroys-unrelated-work defect; this is the same failure reached by a different route, which says the rule is the problem and not the wording. The FORM of the fix is a design decision with three live options and real cost, so it goes to the owner rather than being chosen here; the amendment follows the decision
- F4 · accepted · the gap is real, with one correction to the reviewer's list: `selftest-all.mjs` is already exempted in `commandList` with a written reason — every command it runs is run individually by the glob, so observing it walks the same set twice — and `ci-runs-selftests.mjs` IS in the list. Verified by reading `commandList`. What survives is the substance: the list is hand-written, D32 says “every build and evidence command”, and `npm run validate`, `claude plugin validate --strict skills`, `scripts/validate-skills.mjs --check-versions`, `scripts/tests/check-versions.test.mjs` and the rest of the D34 chain are not in it. A hand-kept list under a sentence that says “every” is the same shape as A16's false claim and A20's prose-only control. Deriving it mechanically from the plan's own `cmd:` fields is the right answer and is a real piece of work, so it goes to the owner with F3
- F5 · accepted · folded into A22 rather than given its own amendment: it names two of the six places (Data 2 and Data 3) that the same lifecycle correction fixes, and 3.2 is not gating. Recording it separately would double-count one defect against the rate

### Round note — the first non-converging round

Rounds 7, 8 and 9 each cleared their predecessor. Round 10 is the first to report `EARLIER: unresolved`, the first whose coverage FELL (13/15 layers · 47/49 probes → 12/15 · 45/49), and the first in which the findings are predominantly consequences of the previous round's own fixes: A19's partial sweep produced F1, A21's two new scripts produced F2. That is a different signal from rounds 7–9, where each round found defects that predated it. It is recorded here because it is the evidence behind the convergence decision put to the owner, and because it belongs in the close report whatever that decision is.

## Review 11 · 2026-09-20 · codex · plan commit c27f0cf

Independent, score-redacted plan, no prior reviews shown; the prompt carried the convergence header and the
request for an `EARLIER:` line. Reviewer: Codex CLI, read-only. Findings verbatim.

F1 `blocking` — Probe **14.3** remains unanswered: D30 and Rollout 3 prescribe `git revert <base>..HEAD`, while D30 also says a mixed interval must use path-scoped restoration with shared files left for hand merge; its stated command still claims the entire commit set was reverted and the tree equals the base, so there is no single executable rollback for the actual mixed interval.
Fix: make the mixed-interval path-scoped procedure the sole exact rollback contract, including deterministic treatment of each shared file, and make `rollback-check.mjs` execute and verify that branch without claiming a range revert or base-tree equality.

F2 `blocking` — Probe **10.1** remains unanswered for a concurrent final-target replacement: D9 validates the destination before writing a separate temporary file, but another actor can replace the destination with a plan, reviews file, index, or link before `rename`; none of D9's fixtures races the final target, so the rename can overwrite a newly unauthorized target.
Fix: publish with a final-target operation that cannot replace an existing or changed destination, or revalidate a stable final-target identity immediately at publication and fail closed; add that target-replacement race to D9's executable evidence.

F3 `blocking` — Probe **12.4** remains unanswered because the plan does not compute a coherent set of introduced checks: Failure & observability says "ten," enumerates four rules plus six checkers, later says "any of the nine," while D33 subsequently adds two assertion-enforcing runners; `node scripts/selftest-all.mjs` is not stated to derive and exercise the reporting/silent/empty triplet for this complete set.
Fix: derive one authoritative set of all introduced checks, including both runners, and have the stated command fail when any member lacks its failing, silent, or non-pass-looking empty case.

F4 `advisory` — Probe **4.2**'s growth invariant misses the case where an amendment names an existing but wrong leaf: D17 verifies that the package resolves, but not that the added item is owned by that same leaf, so growth can be silently attributed to the wrong package.
Fix: compare each amendment's package with the added item's unique D15 owner and report a mismatch.

EARLIER: unresolved rollback scope, final-target authorization race, and an incomplete "every check" set.
12/15 layers · 46/49 probes
VERDICT: REVISE
CONVERGENCE: no — EARLIER is unresolved, blind coverage is `12/15 · 46/49` rather than the plan's `14/15 · 48/49`, and F1—F3 name gating probes, so another round is required.

### Dispositions

- F1 · accepted · in part, and the part I rejected is worth stating because the reviewer was reading a stale claim. D30 does NOT still claim the tree equals the base: A24 replaced that with two cases and `rollback-check.mjs` prints the conditional line, which I re-ran to confirm. What IS true, and is the same defect one document over, is that **Rollout 3(a) still prescribed the bare `git revert <base>..HEAD`** — in the section whose own preamble says it is a restatement of D30 and whose rule (A12) is that a change is made in D30 and copied there, never the reverse. A24 was not copied. So the rule written to stop this exact drift did not survive its first test. Applied as A28. The residual — a `shared` path goes to a hand merge, which is not an "exact step" — is real and is left OPEN.
- F2 · accepted · and left OPEN, carried to `plan-limits`. Verified against D9: the destination is validated, then the temp file is opened `O_CREAT | O_EXCL`, then `renameSync` puts it in place, and `rename` clobbers. Between the check and the rename another process can put a plan file, the index or a link at that path, so the authorization D9 establishes is not the authorization the write lands on. It is a genuine TOCTOU on the final target and probe 10.1 is gating. I am not fixing it at close: Node has no portable atomic non-clobbering rename (`link`+`unlink` is POSIX-only and Windows is the documented build host), so a correct fix is new design, not a patch. Inventing it in the last hour of a plan is how a close report stops being true.
- F3 · accepted · confirmed in full and applied as A27, and it is worse than the reviewer could see from the plan alone. The arithmetic is exactly as described (ten, then nine, in one paragraph; six, then eight, in one item). The part only a run reveals: `selftest-all.mjs` actually RAN six suites. **Round 10's F2 named this same set**, I accepted it as A23, and A23 gave the two runners their `ASSERTIONS` registries and wrote them into D33's prose — and never touched `targets()`. So the fix was half applied, the prose recorded the whole intent, and the evidence command went on passing for five rounds while the two scripts that decide whether every other suite passed were the two nothing ran. The set is now derived by one rule in both directories. Run goes 6 suites to 8.
- F4 · accepted · and left OPEN, carried to `plan-limits`. Verified against D17: it reports `<An> names package <Wid>, which is not a leaf work package`, so it checks that the name RESOLVES to a leaf and never that the added `+Dn` is the item that leaf owns under D15. An amendment can therefore attribute its growth to a real but wrong package and `grew:` will report it without complaint. Advisory and non-gating, and the fix touches `dod-index.mjs`, which is the live skill; it is small, but it is new checking logic with a new fixture and it belongs in a plan that is open rather than one being closed.

### Round note — what the last round was for

The owner's decision of 2026-09-20 was "one more round, then close either way". Round 11 returned three gating
findings, so convergence fails and this plan does not converge: `review: pending` stands, and the close report
will say so rather than claiming an approval that was never earned.

The round paid for itself twice. A27 is the eighth amendment of one shape — a set computed once and not
re-derived — and A28 is the ninth instance of the wider pattern, an edit made in one document and not its
pair. More useful than either: this round found that round 10's F2 had been only half fixed. A23 changed the
sentence and not the code, and nothing compared them, so the plan's own text was the thing asserting the fix.
That is the finding this child hands to 0.3.0, and it is larger than any single item here: **every rule this
plan wrote as prose drifted; every rule it built into a checker held.** A12 wrote "Rollout 3 is copied from
D30, never the reverse" as prose, and A24 broke it. A8 and A23 wrote "every checker" as prose, and the code
ran six. The amendments that stuck — A24's `shared-markers-are-earned`, A25's exemption block, A26's
in-progress rule, A27's registry derivation — are the ones where something executable checks the claim.

## Review 12 · 2026-09-20 · human · plan commit 8535728

The owner answered the rubric's four questions on the current revision — 34/34 items with evidence, A1–A30 recorded,
Reviews 7–11 dispositioned — after the Codex loop had closed unconverged at round 11 by the owner's decision of
2026-09-20 ("one more round, then close either way"). The close then showed that decision has no path through the
script: `done` needs a READY review dated on or after A28 (14.3, corrected, 2026-09-20). The review page
(`docs/dod/wbs-view.review.html`, regenerated for this revision and published as
https://claude.ai/artifact/L3cbnxtRbD1ZWppowQUgJJ) carried a briefing on the 24 amendments since round 6, the two
carried findings and the three alternatives above the generated page. Answer recorded verbatim: "None to all four — READY".

F1 [advisory] Coverage: no layer named as a Gap.
Fix: none.

F2 [advisory] Contest: no pointer, assumption or decision rejected — carrying Review 11 F2 (10.1, D9's final-target race) and F4 (4.2, D17 checks the leaf resolves, not that it owns the item) to `plan-limits` stands; both stay open on record, not fixed.
Fix: none.

F3 [advisory] Scenarios: no unhandled scenario named.
Fix: none.

F4 [advisory] Verifiability: no item found unverifiable by its stated evidence; no blocking gap.
Fix: none.

15/15 layers · 49/49 probes
VERDICT: READY
### Dispositions
- F1 · accepted · no change
- F2 · accepted · no change
- F3 · accepted · no change
- F4 · accepted · no change
