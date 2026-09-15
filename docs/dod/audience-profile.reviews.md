## Review 1 · 2026-09-15 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 1, dod 0.1.3 rubric.

F1 [advisory] Blind rescore: Considered—1 Purpose, 2 Design › Permissions, 3 Design › Data, 4 Business rules, 5 Interfaces › Internal, 6 Interfaces › External, 8 Use cases › Minimal stretch, 9 Use cases › Maximal stretch, 10 Security, 15 Out of scope; Gap—7.3, 11.3, 12.3, 13.1, 14.3; no layer is genuinely N/A.
Fix: Update Coverage to reflect these results after resolving the blocking gaps below.

F2 [blocking] Probe `7.3` is unanswered: interruption is covered, but cancel and undo behavior are not decided.
Fix: State whether an in-progress question can be cancelled and how the owner undoes a completed setup or one-technology append without losing unrelated profile content.

F3 [blocking] Probe `11.3` is unanswered: “plain text” and 120-column output address color and width, but not keyboard operation, screen-reader behavior, or the small-screen wrapping policy.
Fix: State that all interactions are keyboard-operable, prompts preserve screen-reader-safe reading order, and output wraps without truncation on narrow terminals.

F4 [blocking] Probe `12.3` is unanswered: pre-release validation and manual fixtures do not reveal a wording regression after release.
Fix: Name the post-release detection mechanism, such as a release smoke check owned by the maintainer or an explicit support-report-only policy with its review route.

F5 [blocking] Probe `13.1` is unanswered: “one small file read” is a mechanism, not an actionable latency or throughput budget.
Fix: Set a measurable budget for `--profile`/recon and identify profile parsing plus wording generation as the hot path.

F6 [blocking] Gating probe `14.3` is unanswered: `git revert <this plan's commit>` is neither an exact commit nor a complete rollback procedure for released or installed plugin copies.
Fix: Specify the source commit/release to revert, rebuild/publish or reinstall steps, who performs them, and confirm that existing Audience sections remain inert after downgrade.

F7 [blocking] D1, D3, D7, D8, D10, D11, and D12 are unverifiable by their `file` evidence: a stranger checking only the listed headings or substrings cannot verify the promised semantics for probes `4.1`, `10.1`, or the other behaviors those items claim.
Fix: Use tests or explicit manual assertions for behavioral claims, or narrow each item to exact file content whose complete requirements can be verified from the cited file.

F8 [blocking] The acceptance gate fails for layer 8: its pointer cites D8, but D8 is a wording-example fixture and verifies neither probe `8.1` nor `8.2`.
Fix: Add a D-item demonstrating the all-expert/default-only path and verifying that one-time use creates no re-ask, nag, or artifact beyond the documented profile section.

F9 [advisory] Three unhandled scenarios remain: concurrent whole-section writes can silently lose one session’s row (`7.2`); a million-row hand-edited profile has no bounded behavior (`13.2`); and a repository-local `profile.md` symlink can cross the asserted repository ownership boundary (`10.1`).
Fix: Amend the plan with merge-safe writes, a defensible file/row bound, and an explicit symlink policy.

F10 [advisory] A-2 and A-5 are not as reversible as claimed: moving the section affects more than the stated two references, while changing the git default cannot retract proficiency data already committed or copied.
Fix: List every path and compatibility step for A-2, and describe A-5 as a privacy-policy decision with remediation for existing repository history.

10/15 layers · 40/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · blind rescore noted; coverage restated after the fixes below
- F2 · accepted · 7.3 now states cancel (nothing written until shown and accepted) and undo (delete the section or the one appended line; both write paths touch only the section span)
- F3 · accepted · 11.3 states keyboard-only surface, one row per line with no tables, fixed reading order, wrapping between rows, ≤ 120 columns
- F4 · accepted · 12.3 names two mechanisms: selftest in CI for the parser; report-and-release-checklist policy for wording, with the CONTRIBUTING.md line and the maintainer as the route
- F5 · accepted · 13.1 sets ≤ 50 ms at 100 rows, measured and printed by the selftest; hot path named
- F6 · accepted · 14.3 is one procedure: revert the build commit named by D9's evidence line, ship as 0.2.5/0.1.5 (versions never go backwards), re-install per host; sections stay inert
- F7 · accepted · D1, D3, D7, D8, D10, D11, D12 turned into manual checklists with the statements to tick and counts to record; D12 keeps one grep for the root README row
- F8 · accepted · D13 added: expert-only path byte-identical to no section, no re-ask, nothing else in the store
- F9 · accepted · 7.2 distinguishes the one-line append (re-read before append) from the setup rewrite (last-write-wins on one machine, accepted until epic D35); 13.2 adds the 1 MB and 500-row bounds to D2; 10.1 states the symlink limitation as for the store README
- F10 · accepted · A-2 lists the six places and the migration warning; A-5 is a privacy-policy decision reversible for future writes only, history not retractable, said at the question


## Review 2 · 2026-09-15 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 2, dod 0.1.3 rubric.

F1 `[blocking]` The no-profile state is contradictory: 7.1 selects `working`, while D13 and Rollout say it is byte-identical to `default · expert`; this leaves probe `4.4` without precedence.
Fix: Decide whether an absent profile means `working` or legacy/expert wording, and apply that decision consistently throughout the plan.

F2 `[blocking]` The same contradiction leaves probe `7.1` without one actionable first-run/not-set state.
Fix: State the single effective level used when `## Audience` is absent and revise D13, States, and Rollout accordingly.

F3 `[blocking]` Probe `14.1` is unanswered because “delete the section to turn it off” has two incompatible stated outcomes: working-level wording and byte-identical legacy/expert wording.
Fix: Define the exact off-state behavior and identify who can restore or disable it.

F4 `[blocking]` D7’s command evidence is unverifiable by a stranger because `<the review prompt built for any plan…>` is neither a runnable command nor a named generated file.
Fix: Give the exact command that builds the prompt and the concrete path or pipe passed to the profile-line assertion.

F5 `[blocking]` D13’s byte-identical requirement is unverifiable by its manual evidence because “fixed seed request” specifies no deterministic model seed, captured fixtures, or normalization procedure.
Fix: Use deterministic stored fixtures or specify an executable capture-and-normalize procedure whose diff excludes all nondeterministic fields.

F6 `[advisory]` Probe `3.1` decides that `who` is limited to 80 characters and `asked` must be a valid date, but D2’s parser problems and selftest omit both invalid-input cases.
Fix: Add invalid/oversized `who` and invalid-date fixtures with their expected messages and exit status.

F7 `[advisory]` Probe `7.2` does not explicitly cover a whole-section `setup` rewrite racing a one-technology append; the append can be silently lost depending on write order.
Fix: State the mixed-write outcome and add a fixture or manual race check for it.

F8 `[advisory]` Probe `9.3` compares duplicates case-insensitively but does not address aliases such as `JS` versus `JavaScript`, allowing repeated questions and semantically duplicate rows.
Fix: State that aliases remain distinct in this version or define a canonicalization rule.

F9 `[advisory]` Probe `10.1` deliberately follows repository symlinks, so a writable `profile.md` symlink can modify a file outside the repository despite the claimed repository boundary.
Fix: Document the boundary as OS filesystem authority rather than repository containment, and surface the resolved-target warning before writing.

F10 `[advisory]` Probe `13.1` sets a ≤50 ms budget, but D2 only records elapsed time and never asserts the threshold.
Fix: Make the selftest fail when the 100-row parse exceeds 50 ms, or explicitly classify timing as informational and remove the budget claim.

F11 `[advisory]` Blind rescore: Considered—1 `Purpose & typical use`; 2 `Design › Permissions`; 3 `Design › Data`; 5 `Interfaces › Internal`; 6 `Interfaces › External`; 8 `Use cases › Minimal stretch`; 9 `Use cases › Maximal stretch`; 10 `Security`; 11 `Design › UX`; 12 `Failure & observability`; 13 `Performance`; 15 `Out of scope`. Gap—4 (`4.4`), 7 (`7.1`), 14 (`14.1`). N/A—none.
Fix: Resolve the three contradictory probes; all other applicable probes contain actionable decisions at the cited sections, though the advisory evidence weaknesses above remain.

12/15 layers · 42/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · one rule: no valid level → effective `expert` (today's wording); 4.4 precedence now session › row › default › expert
- F2 · accepted · 7.1 rewritten around that rule; `skip` re-asks at the next plan since nothing is written
- F3 · accepted · 14.1 defines the off-state as the absence of gloss markers and names who turns it off and on
- F4 · accepted · D7 evidence is a grep on `review-prompt.txt` built in the D5 scratch project
- F5 · accepted · byte-identical dropped; each level has a fixed gloss marker (4.1), D13 greps for them — zero with expert-only, ≥ 1 and only in prose sections with `CSS · new`
- F6 · accepted · `who` > 80 and invalid `asked` added to D2's problems and fixtures
- F7 · accepted · 7.2 states the mixed-write outcome (an append lost in the window is re-asked); no fixture, reason given
- F8 · accepted · aliases are distinct rows in this version; audience.md tells the model to reuse the existing name
- F9 · accepted · 10.1 names OS filesystem authority as the boundary; setup shows the resolved path before writing through a symlink (D3 checklist 7/7)
- F10 · accepted · timing classified informational; the budget claim removed
- F11 · accepted · blind rescore noted

## Review 3 · 2026-09-15 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 3, dod 0.1.3 rubric.

F1 [blocking] `4.4` is contradictory: D5 re-asks for every unrated technology, while D13 and 7.1 say `default · expert` with no technology rows causes no re-ask.
Fix: State whether a valid `default` suppresses technology-specific questions; if not, define the explicit exception that makes D13’s no-question path valid.

F2 [blocking] `3.1` leaves the per-technology answer incomplete: `Python expert, CSS new` supplies neither `default` nor `who`, yet D4 expects `default working`, without defining how either value is obtained.
Fix: Specify required/optional fields, their defaults or prompts, and the exact write result for every accepted answer form.

F3 [blocking] `9.1` does not decide what happens when one plan touches more than the 12-technology question cap: those technologies are already “touched,” so deferring them until touched is impossible.
Fix: State whether the skill asks consecutive capped batches, proceeds with `default` for the remainder, or aborts pending another plan.

F4 [blocking] `10.1` is not verifiable through D7’s evidence: its grep excludes only profile-shaped rows, so a prompt containing `## Audience` or exposed level values in another form still passes.
Fix: Add a reproducible inspection that rejects the Audience heading and all serialized profile fields/values while allowing level words legitimately present in the redacted plan.

F5 [blocking] `8.2` is unverifiable through D13 because its requirement says only the plan and `profile.md` remain, while its evidence explicitly expects `README.md` too; a stranger cannot determine which file set passes.
Fix: Give one exact expected directory listing, including whether the pre-existing `README.md` is excluded from the “nothing added” claim.

F6 [advisory] A-5 is not meaningfully reversible: changing the future git default does not remove proficiency data already committed or replicated.
Fix: Classify it as a validated policy decision, or describe a repository-history remediation and its limitations instead of calling it reversible.

F7 [advisory] The unauthorized-path analysis does not cover a symlink target being swapped after the displayed `realpath` check but before the write, so the shown destination may not be the actual destination.
Fix: Amend the build to revalidate immediately before writing or document the race explicitly alongside the existing symlink limitation.

F8 [advisory] Build step 5 adds the release-checklist control used by `12.3` but cites only D9 and D12, neither of which verifies that CONTRIBUTING.md received the stated checklist line.
Fix: Add that checklist assertion to a D-item and cite it from build step 5.

12/15 layers · 42/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · `default` applies to product/process sentences and assumed rows only; an unrated technology is always asked (4.1, 4.4); D13 rates every technology the scratch plan touches
- F2 · accepted · 3.1 lists the five answer forms and the exact section each writes; `default · working` and `who · project owner` when not given; D3/D4 updated
- F3 · accepted · 9.1: consecutive batches of 12 until every touched technology is rated; never `default` for a touched one
- F4 · accepted · D7 grep rejects the heading, every field line and every technology row form; level words in prose are not matched
- F5 · accepted · D13 states the exact listing (README.md, profile.md, the plan, an optional reviews file); 8.2 restated
- F6 · accepted · A-5 narrowed to the two defaults, reversible for future writes; the history limitation lives in 10.4 as a limitation
- F7 · accepted · the swap race is documented next to the symlink limitation; no re-check claimed to close it
- F8 · accepted · CONTRIBUTING line verified by D12's grep; build step 5 cites it

## Review 4 · 2026-09-15 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 4, dod 0.1.3 rubric. Round 4, beyond the cap at the owner's request.

F1 [blocking] `3.1` is contradictory: `all expert` writes a row for every listed technology under Design › Data, but Minimal stretch says it writes no technology rows, so the serialized input contract is undecided.
Fix: choose one exact `all <level>` write result and make 3.1, 8.1, D3, D4, and D13 agree.

F2 [blocking] `3.1` and `12.1` conflict on a second unusable answer: one says treat it as `skip`, while the other says use `default`, leaving invalid-input handling undecided.
Fix: state that the second unusable answer either writes nothing and uses session `expert`, or writes a specified default profile, consistently everywhere.

F3 [blocking] `3.1` does not define technology rows for a standalone `default <level>` answer even though it also says every accepted answer writes “the rows”; a builder cannot determine whether rows are omitted or synthesized and at which level.
Fix: specify the complete serialized section produced by `default <level>`, including whether technology rows are written and their values.

F4 [blocking] `12.1` inherits the contradictory second-invalid-answer outcomes, so a stranger cannot verify which failure response and recovery should appear.
Fix: make 12.1 name the same final response, persistence result, and effective session level selected for `3.1`.

F5 [blocking] `13.1` explicitly declines to set a latency or throughput budget and records timing without an assertion, leaving the probe’s acceptance boundary unanswered.
Fix: state an enforceable parser budget for a defined profile size and environment, or provide a genuine applicability test establishing why no performance budget applies.

F6 [advisory] D5 expects every CSS term to be followed by a consequence, while the `new` rule requires plain words first and the term afterward; a stranger cannot satisfy both observations as written.
Fix: change D5’s observation to require plain words first, the term in brackets, and one `For example,` clause.

F7 [advisory] The maximal-stretch scenario of 13 or more unrated technologies is decided as consecutive batches, but no DoD evidence exercises the boundary or verifies that planning waits until all batches finish.
Fix: add a 13-technology manual fixture checking batches of 12 and 1, with no default substitution.

F8 [advisory] The one-technology append path is said both to be shown before writing in Security and merely written after the answer in States/D5; the exact preview and symlink-warning behavior for that second write path is unclear.
Fix: align the sections and manual evidence on whether the append previews the exact line and resolved destination before writing.

F9 [advisory] A-4 understates reversibility: changing the batch cap affects audience.md, D5/maximal-stretch expectations, and any prompt/manual fixture—not only one prose constant.
Fix: list all affected evidence and documentation locations in A-4’s fallback cost.

F10 [advisory] `14.3` refers to a build-commit hash “carried by this plan’s D9 evidence line,” but D9 does not require recording that hash.
Fix: require D9 or the build log evidence to record the exact commit used by the rollback command.

12/15 layers · 42/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · one write contract in 3.1: every accepted answer writes every listed technology; 8.1 and D13 agree
- F2 · accepted · a second unusable answer is `skip` in 3.1 and 12.1: nothing written, effective `expert`, asked again next plan
- F3 · accepted · standalone `default <level>` writes the default and every listed technology at that level
- F4 · accepted · 12.1 names the same response, persistence result and session level as 3.1
- F5 · accepted · 13.1 asserts ≤ 250 ms for 500 rows in the selftest (100× the expectation, so runners cannot flake it)
- F6 · accepted · D5 observes the `new` rule as written (plain words first, term in brackets, `For example,`)
- F7 · accepted · D14: 13-technology scratch project, batches of 12 and 1, no default substitution
- F8 · accepted · the append shows its exact line (and resolved destination) before writing — 7.3, D5
- F9 · accepted · A-4 lists audience.md, setup.md, D14 and the README as the cost
- F10 · accepted · 14.3 names the `commit` field of D9's evidence line, which the Log grammar requires

## Review 5 · 2026-09-15 · codex

F1 [blocking] `4.3` leaves the meaning of `asked · <today>` undecided because no timezone or date-boundary rule is stated.
Fix: State that `asked` uses either the owner’s local date or UTC, including which date wins when a session crosses midnight.

F2 [blocking] `8.1` does not decide the minimal case where repository scanning finds zero technologies; the plan only covers one technology, defaults, and `skip`.
Fix: State whether setup omits the question, asks for `default` only, or writes a zero-technology Audience section.

F3 [blocking] D1 is unverifiable as written: it requires the checker to confirm “six” never-applies places but enumerates seven—D-items, Build plan, Coverage, Log, Baseline, reviewer prompt, and rubric.
Fix: Change the checklist and expected count to seven, or combine/remove one explicitly.

F4 [blocking] D7 is unverifiable by its stated grep evidence: the item claims the prompt contains no “level,” while the command only rejects serialized Audience rows and explicitly permits level words elsewhere.
Fix: Narrow the requirement to exclusion of the serialized Audience section and fields, or provide evidence that checks the broader no-level claim.

F5 [blocking] D14 is not reproducible by a stranger because 13 repository markers do not define 13 distinct detected technologies—for example, `Dockerfile` and `docker-compose.yml` may both map to Docker—and no expected ordered detection list is specified.
Fix: Use a fixture or stub that deterministically yields 13 named technologies and state the exact first and second batches.

F6 [advisory] The hostile-input scenario in `10.2` handles C0 controls but not Unicode bidi or other display-control characters that can visually spoof technology names in terminal questions.
Fix: Reject or escape Unicode formatting controls before displaying names and add a representative fixture.

F7 [advisory] The interrupted-write scenario conflicts with `7.3` and `12.1`: ordinary whole-section writing does not guarantee that an OS failure leaves “nothing partially written,” especially before the deferred atomic writer exists.
Fix: Describe the actual failure outcome and recovery, or implement a temporary-file-and-rename write before asserting no partial changes.

F8 [advisory] A-4 understates reversibility: changing the batch cap also affects the Performance text, maximal-stretch policy, D1’s generated instructions, and potentially recorded prompt expectations, not only the four locations listed.
Fix: Expand the fallback impact list and characterize the change as a coordinated documentation-and-fixture update.

F9 [advisory] The minimal “all expert once” scenario can still nag later when a future plan discovers a technology absent from the original scan, contrary to the statement that an owner who never wants adaptation answers once.
Fix: Clarify that “once” applies only to currently listed technologies, or add a persistent opt-out mode.

13/15 layers · 43/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · 4.3: `asked` is the machine's local calendar date at the moment of the write; a session crossing midnight carries the later date (revision 6)
- F2 · accepted · 8.1: a scan that finds no technology still asks, lists `none yet`, writes `who`/`default`/`asked` and no rows; the first plan that touches a technology uses the one-technology re-ask (revision 6)
- F3 · accepted · D1 tick 4 now counts seven never-applies places (revision 6)
- F4 · accepted · D7 narrowed to the `## Audience` section, its field lines and its technology rows — exactly what the anchored grep rejects (revision 6)
- F5 · accepted · D14 fixture names 13 marker files mapping to 13 distinct technologies, listed alphabetically; both batches spelled out (revision 6)
- F6 · accepted · 10.2 and D2: `\p{Cf}` stripped with C0/C1 using the class `storeFooter` already has; selftest fixture with U+202E (revision 6)
- F7 · accepted · 12.1 and 7.3 now describe the non-atomic whole-file write, the truncated-file outcome, `--profile` detection and the two recoveries; atomic writer deferred to the epic's D35 (revision 6)
- F8 · accepted · A-4 lists every location the cap touches and calls it a coordinated documentation-and-fixture update (revision 6)
- F9 · accepted · 8.1: "once" is once per listed technology; a later unlisted technology is asked once, one row (revision 6)

## Review 6 · 2026-09-15 · codex

F1 `[blocking]` Probe `3.1` is unanswered for invalid `explain` targets: the plan defines valid target forms but not the response to a missing, ambiguous, or nonexistent D/A/F/question identifier.  
Fix: State that an invalid target makes no file change and returns a deterministic error listing the valid target forms and available matching identifiers.

F2 `[blocking]` Probe `6.2` covers only Node being absent; it does not decide what happens when Node starts but hangs or exceeds the parsing budget, so the dependency’s slow path remains undefined.  
Fix: State a timeout or no-timeout policy and whether the model falls back to direct reading, aborts, or warns when `--profile` does not complete.

F3 `[blocking]` Probe `7.3` is unanswered when a multi-batch audience question is cancelled or interrupted after an earlier batch was accepted: the plan does not say whether earlier batches were already persisted, rolled back, or resumed later.  
Fix: Choose batch-level or all-batches atomicity and state the stored profile, effective level, and next-session re-entry behavior after partial completion.

F4 `[blocking]` D4 is unverifiable by its stated manual evidence because `claude -p "/dod setup"` is presented as a non-interactive invocation while the verifier is then instructed to answer its question in the same run.  
Fix: Replace it with an explicitly interactive command/session procedure, or specify a supported mechanism that supplies the answer to the `-p` run.

F5 `[blocking]` D5 is unverifiable by a stranger because “a database technology” has no required identity, yet the evidence expects an exact appended row and technology-specific wording without defining whether recon must select SQLite, Postgres, or something else.  
Fix: Give the scratch project a named database marker and require one exact detected technology and appended row.

F6 `[blocking]` D12 is unverifiable for its root-README claim because `grep -c "audience" README.md` can pass for an occurrence anywhere, not specifically in the dod row.  
Fix: Use an anchored command that identifies the dod row and asserts that row contains the audience-profile wording.

F7 `[advisory]` The 11.3 coverage pointer overclaims D4: observing the question does not systematically verify screen-reader order, the no-table rule, or the ≤120-column bound.  
Fix: Add those checks to D3’s source checklist or give D4 an explicit line-length and ordering inspection procedure.

F8 `[advisory]` A-2 is not convincingly “reversible”: moving the section changes six consumers, introduces migration behavior, and leaves old committed profiles silently ineffective except for a proposed warning.  
Fix: Classify it as a committed storage-interface decision, or define and test a compatibility period in which both locations are read.

F9 `[advisory]` The concurrent same-technology path knowingly creates duplicate rows and leaves repair to the owner, but no D-item exercises the stated detection-and-recovery outcome.  
Fix: Add a fixture or manual row that creates the duplicate, checks the diagnostic, removes one row, and confirms parsing recovers.

Blind scoring: 1 Considered—Purpose & typical use; 2 Considered—Design › Permissions; 3 Gap—Design › Data leaves 3.1 incomplete; 4 Considered—Business rules; 5 Considered—Interfaces › Internal; 6 Gap—Interfaces › External leaves 6.2 incomplete; 7 Gap—Design › States leaves 7.3 incomplete; 8 Considered—Use cases › Minimal stretch; 9 Considered—Use cases › Maximal stretch; 10 Considered—Security; 11 Considered—Design › UX; 12 Considered—Failure & observability; 13 Considered—Performance; 14 Considered—Rollout; 15 Considered—Out of scope. No layer qualifies for N/A.

12/15 layers · 42/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · 3.1b: an invalid, ambiguous or malformed `explain` target changes nothing and returns one deterministic line listing the valid identifiers; D6 checks `explain D99` (revision 7)
- F2 · accepted · 6.2: `--profile` not returning within 30 s is 12.1's unreadable class — warning line, effective `expert`, never a hand-parse (revision 7)
- F3 · accepted · 7.3/9.1/D14: batch-level persistence; each accepted batch is written before the next is asked; an interruption keeps accepted rows and re-asks only the rest; D14 exercises it (revision 7)
- F4 · accepted · D4, D14 and the Build plan use interactive `claude` sessions; `claude -p` cannot take the answer (revision 7)
- F5 · accepted · D4's scratch project carries `schema.sql` (`-- SQLite`); D5 asks about SQLite by name and expects `- SQLite · <level>` (revision 7)
- F6 · accepted · D12's grep anchored to the `dod` row of the root README (revision 7)
- F7 · accepted · D3 now has nine ticks including no-table and ≤ 120 columns on the source text; the 11.3 pointer cites D3 for the shape and D4 for the rendered question (revision 7)
- F8 · accepted · A-2 reclassified `validated` with sources; a move is out of scope (15.1) because it would need a compatibility period (revision 7)
- F9 · accepted · 7.2 names the duplicate diagnostic; D2's selftest creates the duplicate, checks the message, removes one row and parses clean (revision 7)

## Review 7 · 2026-09-15 · human · plan commit 29ae364

The owner answered the rubric's four questions on the redacted plan (Coverage status and probe counts
blanked; pointers shown; the 14 items summarised one line each; A-1..A-5 with their types).

F1 [advisory] Re-score blind: all 15 layers Considered — every pointer answers its probes.
Fix: none.

F2 [advisory] Contest: no pointer, assumption or decision rejected.
Fix: none.

F3 [advisory] Hunt: no unhandled scenario named.
Fix: none.

F4 [advisory] Test the tests: no item found unverifiable by its stated evidence; nothing blocking.
Fix: none.

15/15 layers · 45/45 probes
VERDICT: READY
### Dispositions
- F1 · accepted · no change
- F2 · accepted · no change
- F3 · accepted · no change
- F4 · accepted · no change
