## Review 1 · 2026-09-26 · codex · plan commit cfcafa3 · plan 55710 B · 24 items · files 9 · 394c5397bb49 · prompt 6bdfbc315627

F1 [blocking] The blind re-score is Considered only for layers 1 (`Purpose & typical use`), 3 (`Design › Data`), 4 (`Business rules`), 5 (`Interfaces`), 8–9 (`Use cases`), 11 (`Design › UX`), 13 (`Performance`), 14 (`Rollout`), and 15 (`Out of scope`); layers 2, 6, 7, 10, and 12 are Gaps the author did not mark.
Fix: Mark those five layers Gap until the unanswered probes below receive decisions and evidence mappings.

F2 [blocking] `2.1`, `2.2`, and `2.3` are unanswered: `Design › Permissions` lists author, reviewer, owner, and script but never decides access for unauthenticated users, repository admins, service accounts, ownership transfer, or the resulting unauthorized response; D22 is only a generic plan check and cannot fail when that boundary disappears.
Fix: Define every reachable actor, permissions, denial behavior, and transfer/reopen ownership policy, then add one command whose fixture removes that policy and fails.

F3 [blocking] `6.1` and gating probe `6.2` are unanswered: versions are named, but quotas/cost applicability and sampled Node/git/Bash contracts are not decided, while only absence is discussed—not hangs, timeouts, malformed output, rate limits, or sibling-tool failure; `calib.compat` cannot test these failures.
Fix: State the contract and timeout/garbage policy for each dependency and add a fault-injection command that fails when any dependency failure is accepted silently.

F4 [blocking] `7.1` and `7.2` are unanswered: `Design › States` covers empty/first-run but not loading, partial, and error applicability, and sequencing this child after `review-loop` does not decide what happens when two checks, hooks, or retries read different plan/profile/index snapshots.
Fix: State synchronous-state applicability plus a snapshot/concurrency policy, including which result wins or retries, and map it to an executable race fixture.

F5 [blocking] Gating probe `10.1` is unsupported: “the script gains no spawn” is prose, and `paths-walked` detects changed paths rather than unauthorized process execution, option injection, symlink traversal, or reads outside the store.
Fix: Specify the allowed operations and option boundary, then add a command that plants a forbidden spawn/read/option and fails when it executes or escapes containment.

F6 [blocking] `10.2` and `10.4` are unanswered: no D-item fails when hostile note/profile text reaches terminal or generated output unsafely, and the claim that no personal data is collected conflicts with accepting dry-run notes containing personal data while D24 emits only a warning.
Fix: Decide reject-versus-redact behavior for hostile and personal content, its audit/export treatment, and add fixtures that fail when raw content escapes.

F7 [blocking] `12.3` defers production detection to future machine-skill plans, and gating probe `12.4` has no valid command for every gating control: D23 is manual mutation prose, while D22, D20, and D16 do not respectively exercise `2.1`, `3.3`, `6.2`, or `10.1`.
Fix: Name an operational signal now and provide one executable negative command per gating probe with failing, silent, and empty inputs matching the real parser state.

F8 [advisory] The valid gating commands are `4.4` → `node skills/dod/scripts/dod-index.mjs --selftest` (`calib.dry-run-at-ready`), `10.3` → `node scripts/checks/release-check.mjs privacy --base 9ff0454`, `14.3` → `bash docs/dod/calibration.rollback.sh && ! bash docs/dod/calibration.rollback.sh --plant`, and `14.4` → `node scripts/checks/paths-walked.mjs --plan docs/dod/calibration.md --base 9ff0454`; the other five controls lack suitable commands.
Fix: Preserve these four mappings and replace the generic mappings identified in F2, F3, F5, and F7.

F9 [blocking] D7 is unverifiable by its `file` evidence: checking two contained strings cannot prove the Rework line is directly below Prediction rate or that reports never compute the rate without it, so a stranger could pass the item with unrelated text.
Fix: Change D7 to a template-rendering test that asserts adjacency and fails when the Rework line is removed.

F10 [blocking] D12 is unverifiable by its `file` evidence: string presence cannot prove values came from the step-5 spikes, that every row has the measured date, or that corresponding Log notes exist.
Fix: Use a command that compares live spike outputs, parsed Host rows, and dated Log notes field by field.

F11 [blocking] D14 is unverifiable by its `file` evidence because one `file:` detail attempts to validate four separate files and multiple required phrases; a stranger cannot apply the stated evidence type as a single path check.
Fix: Split D14 into one file item per document or replace it with a documentation-sync command that checks every required file and phrase.

F12 [advisory] Minimal/concurrent/unauthorized hunts expose three concrete cases: a zero-item draft with a malformed dry-run note can produce competing empty-state messages (`7.1`); profile or plan changes during store-wide history calculation can make `--check` and the regenerated index disagree (`7.2`); and an untrusted contributor can commit a dry-run command containing dangerous options that is displayed as ordinary text without an actor-policy failure (`2.1`/`10.1`).
Fix: Add these exact fixtures after the underlying state, concurrency, and permission decisions are made.

F13 [advisory] `7.3` deliberately accepts a dry-run recorded before a `~Dn` correction, so evidence for obsolete command text remains current; this is explicit, but not cheap to reverse once approvals depend on it.
Fix: Either invalidate pre-amendment dry runs or document why stale observations remain authoritative and show that choice to reviewers.

F14 [advisory] The Build plan cites D-items on every step, but work package W4.1 owns D15 while listing only step 7 even though D15 is actually performed in step 10 under W4.3.
Fix: Move D15 to W4.3 or add step 10 to W4.1 so item ownership matches execution.

F15 [advisory] `Also considered` is silent on compliance/legal, operational ownership, analytics/success measurement, and decommissioning, despite the rubric requiring one applicability line for each.
Fix: Add an explicit decision or non-applicability test for all four topics.

10/15 layers · 37/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · the five layers were short of decisions; F2–F7 answer them in revision 2
- F2 · accepted · 2.1–2.3 name every actor (repository writers, CI, the hook, reviewers, public readers) under the epic's repository-access policy, the refusal (the host rejects the push; the script has nothing to authorize) and author change mid-plan; +D25 `calib.inert` plants a live command and fails if it runs
- F3 · accepted · 6.1 states no network, quota or cost and names the Node fs contracts relied on; 6.2 states why no hang or timeout exists (local synchronous reads) and +D26 `calib.faults` plants five faults that must warn and never pass
- F4 · accepted · 7.1 answers loading and partial (a synchronous command; a partial read is D26's error state); 7.2 states the snapshot policy (one read per file, no lock, the regenerated index wins, staleness caught by --check-index and D15)
- F5 · accepted · 10.1 names the allowed operations; D25 spies on every spawn function and on openSync
- F6 · accepted · 10.2: +D27 strips C0/C1 controls and cuts echoed text; 10.4: D24 becomes a problem from approval on, so personal output cannot be approved
- F7 · accepted · 12.3 names the signal now (the index's Rework line and per-plan rates of plans approved under D2); 12.4 maps each gating probe to a command able to fail — D23 is now `bash docs/dod/calibration.mutants.sh`
- F8 · accepted · the four valid mappings kept
- F9 · accepted · D7 is a selftest case asserting adjacency inside the code block
- F10 · accepted · D12 is `bash docs/dod/calibration.host-check.sh`, comparing each row with the live spike and counting the spike notes
- F11 · accepted · D14 is a selftest case, per file and per section
- F12 · accepted · 7.1's zero-item malformed note is in D1; 7.2's disagreement is the stale-index case D15 covers; 2.1/10.1's dangerous command is D25's fixture
- F13 · rejected · a dry run is used only at approval; after approval every item needs a pass dated after its last amendment (evidence rule 4), so an old dry run never stands for current evidence — stated in 7.3
- F14 · accepted · D15 moved to W4.3
- F15 · accepted · compliance, operational ownership, analytics and decommissioning each have a line

## Review 2 · 2026-09-26 · codex · plan commit 886d27b · plan 68088 B · 27 items · files 9 · 394c5397bb49 · prompt df9f1b159e64

F1 `blocking` — Probe 2.1 is unanswered because repository push access does not enumerate local processes or users that can edit the workspace directly, and D25 tests execution inertness rather than authorization.
Fix: State whether local filesystem permissions are the authorization boundary, enumerate local and CI actors, and add one command that fails when an unauthorized actor can alter accepted plan or profile data.

F2 `blocking` — Probe 2.2 is unanswered because “the repository rejects the push” does not define the unauthorized path for direct local edits, CI artifacts, generated indexes, or a compromised agent session.
Fix: Define deny/error/audit behavior for each write path, including local writes that bypass the hosting provider.

F3 `blocking` — Probe 3.3 is unanswered for `<tmp>/dod-review-*` and the other temporary artifacts marked `outlives`: no retention duration, cleanup owner, or deletion mechanism is stated.
Fix: Give every temporary artifact a lifetime and deletion command, and name one evidence command that fails when any artifact exceeds that lifetime or survives required cleanup.

F4 `blocking` — Probe 4.5 is internally inconsistent: D13 limits documentation to messages introduced by D1–D11, while Business rules claims “every message” is derived from `MESSAGES_CALIBRATION`, omitting messages introduced by D24–D27.
Fix: Define the set as every calibration message introduced by D1–D27 and make `calib.documented` derive and compare that complete exported set.

F5 `blocking` — Probe 6.1 is unanswered for relied-on executables such as `claude plugin validate`, npm, `sed`, and the release/check scripts: their supported versions and sampled input/output contracts are not stated.
Fix: Enumerate every required executable with its supported version or compatibility rule and the contract spike or fixture that validates it.

F6 `blocking` — Probe 7.2 is unanswered because `loadPlans` can combine different moments across plan, review, and profile files; the claim that a concurrent edit yields “one version or the other, never a mix” holds only per individual read.
Fix: Choose and state store-level consistency semantics—mixed snapshot accepted and labelled, retry-on-change, or locked snapshot—and provide a racing-write fixture for that decision.

F7 `blocking` — Probe 9.1 is unanswered: the plan names 500 plans and 200 items but gives neither the expected baseline nor what degrades at 100× volume.
Fix: State expected and 100× counts, the time/memory budget, and the defined behavior when that budget or bound is reached.

F8 `blocking` — Probe 10.1 has no control evidence: `calib.inert` fails on command execution or out-of-store reads, but cannot fail when authorization is absent from a read, index-write, profile-write, hook, or CI path.
Fix: Name the authorization boundary for every direct and indirect path and provide one evidence command whose unauthorized fixture fails.

F9 `blocking` — Probe 12.4 is unanswered because D23 mutates only eight selected rules, while the plan introduces additional checks in D5, D7, D8, D10, D13, D14, D16, D24–D27; many items also omit an explicit silent input or empty-input output.
Fix: Enumerate every introduced check with failing, silent, and empty fixtures, and provide one aggregate command that fails when any control is removed.

F10 `blocking` — D12 is unverifiable by its stated command: byte equality with live version output cannot let a stranger distinguish “copied from a spike” from manually typed identical text, leaving probe 6.1’s claimed provenance unproved.
Fix: Change the item to require equality only, or record machine-produced spike output with a verifiable hash or generated-file workflow.

F11 `blocking` — D22 is unverifiable by its current command: a final `--check` run cannot prove that the plan and epic had zero problems “at every status,” so a stranger lacks historical evidence for probe 7.3.
Fix: Require and verify a dated `--check` pass record at each transition, or narrow the item to the current and close states.

F12 `blocking` — Probe 13.1’s “under 10% more” budget is not verifiable by D17: its commands test correctness and a 180-second ceiling but record no baseline, calibrated repetitions, or comparison threshold.
Fix: Add a timing command that measures the same workload before and after, defines repetitions and noise tolerance, and fails above 10%.

F13 `blocking` — Probe 13.2 does not say what happens at the 49-probe or 10,000-character bounds, why those limits are appropriate here, or which valid long-output case is excluded.
Fix: Specify truncation or refusal behavior at each bound, its source, and the valid diagnostic output that may be omitted.

F14 `advisory` — D27’s examples can show cleaned output but do not establish its stronger claim that every echo uses the same function; this is inspectable structural work rather than an unresolved product decision.
Fix: Add a static source assertion that all calibration output sites call `echoText`, or narrow D27 to the observable sanitization behavior.

F15 `advisory` — The three requested hunt scenarios are presently exposed by the plan: a direct local unauthorized edit bypasses the repository host (2.1/2.2/10.1), a profile change between plan and profile reads creates a mixed store snapshot (7.2), and a 100× store has no defined degradation behavior (9.1).
Fix: Add those scenarios to the corresponding evidence fixtures after making the policy decisions above.

EARLIER: all resolved
6/15 layers · 38/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · 2.1 names the boundary: the operating system's file permissions on the working copy and the host's push permissions; dod runs as its invoker and holds no credential (the epic's 15.1)
- F2 · accepted · 2.2 gives the unauthorized path per write path (local edit, push, CI, index, authorized tampering); the one tamper dod can see is now refused: D2 rejects a dry-run note dated after `baselined`
- F3 · accepted · 3.3 gives each temporary file a lifetime; +D28 deletes this plan's review prompts and outputs at close and fails if any survives
- F4 · accepted · D13 and 4.5 now cover every message D1–D29, derived from the exported object
- F5 · accepted · 6.1 enumerates npm, Claude Code, sed, Codex and the checkers with versions (S-5) and the contract each is used for
- F6 · accepted · retry-on-change chosen and stated in 7.2; +D29 with a racing seam
- F7 · accepted · 9.1 states expected and 100× counts, a 2,000 ms budget for 1,000 done plans (`calib.scale`), and that nothing refuses beyond it
- F8 · rejected · dod cannot authorize reads or writes it does not own; the boundary is the OS and the host (F1), and the plan now says so per path (F2); an authorization fixture inside the script would test nothing the script controls
- F9 · accepted · D23 reads every `calib-mutant` marker from the source, at least thirteen rules, and every one must be caught
- F10 · accepted · D12 narrowed to equality with the live spike
- F11 · accepted · D22 narrowed to now and close, with a dated check note after each transition
- F12 · accepted · the relative budget replaced by an absolute one (`calib.scale`, the validator's 180 s)
- F13 · accepted · 13.2 states behaviour at 49 probes (none cut) and at the 10,000-character cap (a problem, from plan-limits), and the excluded valid case
- F14 · accepted · D27 narrowed to the observable cleaning
- F15 · accepted · the three scenarios map to D2's back-fill refusal, D29 and `calib.scale`

## Review 3 · 2026-09-26 · codex · plan commit c73df81 · plan 74671 B · 29 items · files 9 · 394c5397bb49 · prompt 50de48abd1b9

F1 [blocking] Probe 3.1 is unanswered because the dry-run grammar splits on the first ` → ` while valid commands may themselves contain that delimiter, so command and output cannot be parsed unambiguously.
Fix: Define escaping or split on an explicitly reserved delimiter, then make `calib.dry-run-grammar` verify round-trip parsing of a command containing ` → `.

F2 [blocking] Probe 3.3 is unanswered because D28’s `! ls <prompt-glob> <output-glob>` succeeds when one surviving class matches but the other glob does not, so a stranger cannot verify cleanup using the stated command.
Fix: Replace it with one command that enumerates both patterns and exits nonzero when any matching artifact survives.

F3 [blocking] Probe 12.4 is unanswered because D23 discovers only existing `calib-mutant:` markers; a new control with no marker is invisible, and Build-plan step 7 additionally promises eight mutations while D23 requires at least thirteen.
Fix: Use an independent rule manifest or source analysis that fails for every unmarked control, and iterate that complete set rather than eight names.

F4 [blocking] Probe 5.3 has an unverifiable D13: its selftest compares `MESSAGES_CALIBRATION` keys with the template, so a stranger cannot detect a new literal problem, warning, or information message emitted outside the table.
Fix: Add a source-level check that enumerates calibration message emission sites and fails unless each resolves through `MESSAGES_CALIBRATION`.

F5 [advisory] Scenario for probe 7.2: a concurrent writer can replace content while preserving size and modification time, causing D29’s snapshot comparison to accept a mixed store view.
Fix: Compare content hashes or file identity as well as size and modification time, or explicitly document this undetected race.

Gating commands checked: 2.1 and 10.1 — D25 `calib.inert`; 3.3 — D28 cleanup command, defective as F2; 4.4 — D2 `calib.dry-run-at-ready`; 6.2 — D26 `calib.faults`; 10.3 — D18 `release-check privacy`; 12.4 — D23 mutant script, defective as F3; 14.3 — D21 rollback rehearsal; 14.4 — D20 `paths-walked`.

EARLIER: all resolved
13/15 layers · 46/49 probes
VERDICT: REVISE

### Dispositions
- F1 · accepted · the dry-run command is a backtick code span (a longer fence when it holds a backtick); `calib.dry-run-grammar` round-trips a command containing ` → `; this plan's own 28 notes rewritten to the form
- F2 · accepted · D28 counts both patterns in one `ls -d … | wc -l` and needs zero
- F3 · accepted · D23 enumerates every `fmtC(` call between `// calib:begin` and `// calib:end` independently of the markers and fails on an unmarked one; step 7's "eight" removed
- F4 · accepted · D13 fails when the calib region pushes anything but an `fmtC(` call
- F5 · accepted · D29 compares SHA-256 of the bytes, re-reading after the last read

## Review 4 · 2026-09-26 · human · plan commit a093951 · the owner, in plan mode, on the review page https://claude.ai/artifact/JknALAN23sSHpe9uxkaHdf (this account), after Codex Reviews 1–3 under the round cap

1. Coverage — stands: every Considered row answers its probes as the plan states them.
2. Contest — none fail; Review 2 F8 (authorization is the operating system and the host, outside dod) stands as ruled.
3. Hunt — no unhandled scenario the owner can name.
4. Test the tests — no blocking gap.

15/15 layers · 49/49 probes
VERDICT: READY

### Dispositions
- F1–F4 · accepted · no change to the plan; approved at a093951

## Review 5 · 2026-10-01 · human · scope A1,A2,A3 · plan commit c88bc14 · the owner, in plan mode, on the pages https://claude.ai/artifact/LMmYSzju4JKH9ELrD5wgJu (A1, A2) and https://claude.ai/artifact/E25iVH1M5mS5V65qdukeqr (A3) (this session's account), each change shown in plain words with the dry-run output that found it

1. Coverage, contest, hunt and test the tests, answered together — "Only in its own files" (A2's allowlist scope), "Now, these answers count" (review A1 and A2 before the build) and "12.4's wording now, rubric 3 later" (A3's scope): A1 and A2 close the gaps the dry runs before start found, each with its failing input run (Log, 2026-10-01); A3 adds D30 as epic A22 asks, with the separate probe deferred.

15/15 layers · 49/49 probes
VERDICT: READY

### Dispositions
- none raised; A1–A3 stand as recorded

## Review 6 · 2026-10-01 · human · plan commit 66804c3 · plan 120314 B · 30 items · files 8 · fff76825cffe · prompt 99bccf265a14 · scope A5,A6,A8 · the owner, in plan mode, on the page https://claude.ai/artifact/UMJMYCBo3NWTrKmndUikVk (this session's account)

1. Coverage — stands: A5 and A6 answer 12.4, A8 answers 14.4.
2. Contest — none fail: each is a fix to a method, not a change of decision.
3. Hunt — no unhandled scenario the owner can name.
4. Test the tests — no blocking gap: calib.snapshot (D29), calibration.mutants.sh 40 of 40 (D23) and paths-walked exit 0 (D20) each rerun by a stranger and each fail with its fix removed.

15/15 layers · 49/49 probes
VERDICT: READY

### Dispositions
- none raised; A5, A6 and A8 stand as recorded
