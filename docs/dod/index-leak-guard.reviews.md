## Review 1 · 2026-09-14 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 1, dod 0.1.2 rubric.

F1 `[blocking]` Probes `2.1` and `10.1` are unanswered: “developer, model, CI” does not define the OS trust boundary or authorization on direct and indirect invocation paths.  
Fix: State that filesystem permissions are the sole authorization boundary, enumerate every local/CI actor that may invoke each command, and state that no jobs, webhooks, or exports bypass it.

F2 `[blocking]` Probe `4.4` is unanswered: Business rules discusses reversibility and points to rollback, but never establishes precedence between conflicting rules or names the exception authority.  
Fix: State the rule ordering—for example, leak prevention overrides freshness and user-authored footer preservation—and name the maintainer as the only exception authority.

F3 `[blocking]` Probe `10.2` is unanswered for the generated footer: only the fixed warning is assessed, while a store path containing backticks, newlines, or Markdown control text reaches generated Markdown without a stated escaping policy.  
Fix: Decide that footer paths are escaped, encoded, or rejected before interpolation, with the chosen transformation forming the output contract.

F4 `[advisory]` The concurrent scenario in `7.2` considers only two writers producing equal bytes; a reader or `--check` racing `writeFileSync` can observe a truncated README, despite atomic writes being deferred.  
Fix: Explicitly accept transient stale/error results until epic D35, or add a race fixture and defined retry behavior to that child.

F5 `[advisory]` D2 is not fully verifiable by its stated test because the fixture does not explicitly exercise both `--check-index` and `--check <slug>`; D5’s command does not verify `SKILL.md` version or an unchanged README; D6’s phrase check cannot verify its three required statements.  
Fix: Name both D2 command paths, add explicit assertions for every D5 file, and make D6 evidence check the relative-path contract, leak explanation, and regeneration remedy.

F6 `[advisory]` The coverage pointers overclaim: layer 9’s Maximal-stretch section does not answer repeated-action/idempotency `9.3` without Design › States, while layers 2, 4, and 10 are Gaps rather than Considered.  
Fix: Use this blind rescore: 1 Considered—Purpose & typical use; 2 Gap; 3 Considered—Design › Data; 4 Gap; 5 Considered—Interfaces › Internal; 6 Considered—Interfaces › External; 7 Considered—Design › States and Failure & observability; 8 Considered—Use cases › Minimal stretch; 9 Considered—Use cases › Maximal stretch and Design › States; 10 Gap; 11 Considered—Design › UX; 12 Considered—Failure & observability; 13 Considered—Performance; 14 Considered—Rollout; 15 Considered—Out of scope.

F7 `[advisory]` `## Also considered` is silent on analytics/success measurement and support tooling, both of which the rubric requires to be expressly decided or rejected.  
Fix: Add explicit lines defining CI/selftest success as the measurement and explaining whether support needs anything beyond the warning and named-file scan failure.

F8 `[advisory]` A-3’s “reversible” fallback is not equivalent: dropping the temp-directory needle weakens the promised leak scan instead of safely reversing an implementation choice.  
Fix: Preserve the contract by canonicalizing the needle or constructing fixtures outside the conflicting prefix, and reserve dropping it for an explicit amendment.

F9 `[advisory]` The maximal-stretch claim fixes generated files at ≤6 and ≤1 MB without stating an enforced bound, so a future fixture can silently invalidate the performance argument (`9.1`, `13.2`).  
Fix: Describe these as current measured fixture sizes or add explicit size/count bounds and the behavior when exceeded.

12/15 layers · 41/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · 2.1/10.1: filesystem permissions are the sole boundary; four invocation paths named; no indirect path
- F2 · accepted · 4.4: precedence leak prevention → freshness → message stability; maintainer is the exception authority
- F3 · accepted · D1 gains the footer escaping rule (backtick → apostrophe, controls → space) with a hostile-directory-name case; 10.2 points at it
- F4 · accepted · 7.2 accepts the transient truncated read until epic D35
- F5 · accepted · D2 exercises both command paths; D5 asserts every file; D6 is a three-statement manual checklist
- F6 · accepted · coverage pointers name the probe-answering text; layer 9 points at States for 7.3
- F7 · accepted · Also considered gains measurement and support lines
- F8 · accepted · A-3 fallback preserves the needle via an alternate scratch root
- F9 · accepted · 9.1/13.2 measured sizes, fixture-count assertion

## Review 2 · 2026-09-14 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 2, dod 0.1.2 rubric.

F1 [blocking] Probe 4.1 is not actionable for a Windows store on another drive or UNC share: `path.relative` can return an absolute path, contradicting D1’s unconditional relative-path contract.
Fix: Satisfy 4.1 by deciding whether cross-root stores are rejected or rendered using a specified non-absolute representation, then cover that case in D1.

F2 [blocking] Probe 2.2 omits the unauthorized read path: an actor lacking permission to read `README.md` is different from the documented read-only-file regeneration failure.
Fix: Satisfy 2.2 by specifying the message, exit code, and logging behavior when `--check` or `--check-index` receives `EACCES` while reading the index.

F3 [blocking] Probe 3.1 does not state the accepted size or malformed-encoding behavior for the untrusted existing `README.md`, despite reading the entire file before inspection.
Fix: Satisfy 3.1 by declaring a size policy and the response to oversized or invalid UTF-8 input, including exit behavior.

F4 [advisory] Probe 9.1 asks about 100× expected volume, but the plan reports only today’s four sub-2-KB fixtures and calls fixture count a bound without evaluating 400 fixtures or identifying degradation.
Fix: State the expected 100× behavior—such as linear runtime and memory growth with unchanged results—and add a representative measurement or fixture.

F5 [advisory] Build-plan step 1 claims to satisfy D1 but never instructs the builder to implement D1’s new footer escaping rule; step 3 only tests it.
Fix: Add the escaping implementation to step 1 and keep step 3 as its verification.

F6 [advisory] D5’s evidence command depends on `grep` although the planned and tested environment includes Windows, so a stranger on that supported environment may be unable to run the stated evidence.
Fix: Replace the `grep` checks with a repository-provided Node command or another explicitly supported cross-platform validator.

F7 [advisory] The acceptance-gate pointers for layers 2, 7, and 14 name nearby items rather than items that verify their decisions: D2/D3 do not verify invocation permissions, D2 does not verify concurrent or interrupted lifecycle behavior, and D5 does not verify rollback compatibility.
Fix: Map each layer to genuinely relevant evidence, or state in its coverage row why unchanged inherited behavior yields no new D-item.

11/15 layers · 41/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · D1: a store on another root renders a fixed no-path sentence; fifth render case with an injected relative()
- F2 · accepted · 2.2: unreadable README → cannot-read message, exit 1 for --check-index, warn-and-continue for --check; sub-case unreadable-index
- F3 · accepted · 3.1: README read only if ≤ 1 MB (else the over-1-MB message), UTF-8 with U+FFFD replacement; sub-cases oversize-index, invalid-utf8-index
- F4 · accepted · 9.1: linear at 100×, a 400-file synthetic scan recorded in leak-scan
- F5 · accepted · build step 1 implements the footer contract and escaping; step 3 verifies
- F6 · accepted · D5 evidence uses a repo-provided validate-skills.mjs --check-versions flag; build step 4 adds it
- F7 · accepted · coverage rows 2, 7, 14 point at the sub-case that verifies them or say plainly what is argued rather than verified

## Review 3 · 2026-09-14 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 3, dod 0.1.2 rubric.

F1 `blocking` — Probe `6.2` does not decide behavior when the newly used `crypto.randomBytes` fails or blocks; “nothing new can fail” conflicts with that added dependency.
Fix: State that entropy failure aborts selftest with a fixed, secret-free error and exit 1, while `finally` restores `DOD_TEST_SECRET` and removes temporary files.

F2 `advisory` — Scenario: another process enlarges `README.md` after `stat` but before `readFileSync`; layer 3, probe `3.1`’s “over 1 MB is not read” guarantee can be violated.
Fix: Use a bounded read or re-check the opened file before reading its contents.

F3 `advisory` — Scenario: a store path contains a C1 character or U+2028/U+2029; layer 10, probe `10.2` specifies their escaping, but D1’s evidence exercises only a backtick and newline.
Fix: Add representative C0, C1, U+2028, and U+2029 inputs to `index-relative`.

F4 `advisory` — Build-plan step 3 cites D2 but omits D2’s `oversize-index`, `invalid-utf8-index`, and `unreadable-index` sub-cases, leaving those required tests absent from the implementation instructions.
Fix: Add all three named sub-cases to step 3.

F5 `advisory` — Scenario: rollback occurs after regeneration; layer 14, probe `14.3` acknowledges that the next 0.1.2 regeneration restores the absolute-path leak, but the operational consequence is easy to miss.
Fix: Require rollback instructions to warn against regeneration under 0.1.2 or to retain the safe footer patch while reverting only the warning/tests.

14/15 layers · 44/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · 6.2: randomBytes failure aborts the selftest with a fixed secret-free line, exit 1, finally restores env and removes the temp store; stub case in D3
- F2 · accepted · 3.1: bounded read from an open descriptor, cap 1 MB + 1
- F3 · accepted · D1 case adds ESC, U+0085, U+2028, U+2029
- F4 · accepted · build step 3 names the three D2 sub-cases
- F5 · accepted · 14.3: rollback keeps the footer fix and reverts only warning and tests; warning goes in the revert message and setup.md

## Review 4 · 2026-09-15 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 4, dod 0.1.2 rubric.

F1 `blocking` — Rollout gives conflicting rollback instructions: revert the whole commit versus retain step 1 and revert only steps 2–3, leaving gating probe `14.3` without one exact rollback procedure.
Fix: For `14.3`, choose one authoritative command/file sequence, identify which footer changes remain, and state whether READMEs written by 0.1.3 remain safe and compatible afterward.

F2 `advisory` — Layer 13 points to D3, but D3 neither creates the claimed synthetic 400-file set nor records timing; Build-plan step 3 also omits it, so the performance/scale acceptance mapping is not independently verifiable.
Fix: Add the 400-file measurement to D3 and Build-plan step 3, or remove that claim and map layer 13 to evidence that actually exists.

F3 `advisory` — Unauthorized-path scenario: a writable store containing a symlinked `README.md` can make regeneration write outside the repository despite 10.1 claiming the store is the only path written under.
Fix: State whether filesystem symlinks are intentionally followed or rejected, then add the corresponding guard or documented limitation.

F4 `advisory` — Concurrent scenario: two `main(["--selftest"])` calls in one Node process can race while overwriting and restoring the process-global `DOD_TEST_SECRET`; 7.2 discusses only concurrent regeneration.
Fix: Serialize selftest environment mutation, inject the secret instead of mutating `process.env`, or explicitly limit supported concurrency to separate processes.

F5 `advisory` — Hostile-input scenario: a POSIX directory component such as `C:\leak` or one containing bidi controls survives the escaping rule and can resemble an absolute path or visually spoof the one-line footer; D1’s anchored drive-prefix assertion would not detect it after `Store: \``.
Fix: Define handling for drive-like relative components and Unicode formatting controls, then align the footer assertion with that decision.

14/15 layers · 44/45 probes
VERDICT: REVISE
### Dispositions
- F1 · accepted · 14.3 now one procedure: revert this plan's commit; the footer fix predates it and stays; READMEs remain byte-identical
- F2 · accepted · D3 and build step 3 print the 400-file scan time; layer 13 pointer names it
- F3 · accepted · 10.1 states symlinked README is followed in v0.1 (epic D4/D35 removes it); D6 gains the fourth statement
- F4 · accepted · 7.2: selftest concurrency is separate processes only
- F5 · accepted · D1 strips Cf (bidi) characters; drive-like relative components rendered as-is with the footer-start assertion

## Review 5 · 2026-09-15 · codex
Reviewer: Codex CLI 0.151, `codex exec -s read-only`, score-redacted revision 5, dod 0.1.2 rubric.

F1 `advisory` — D1 contradicts itself under 3.2/4.2: a POSIX component named `C:\leak` must remain, yet the item also says the rendered text may never contain a drive letter followed by `:\`; a stranger cannot satisfy both literal assertions.
Fix: Limit the drive/UNC prohibition to the path’s beginning immediately after `Store: \``, consistently with the stated whole-path rule.

F2 `advisory` — The minimal first-run scenario under 7.1 is only implied: the plan never explicitly says how `--check-index` and `--check <slug>` behave when `README.md` does not exist.
Fix: State that a missing README is stale, gives the existing missing/stale message and exit behavior, and is not classified as a legacy footer.

F3 `advisory` — D3’s 9.1/10.3 claim that every generated file is scanned is not guaranteed by “scan every README rendered so far”; a fixture added after `leak-scan` could escape scanning while the rendered-count assertion still passes.
Fix: Accumulate every rendered output centrally and perform the count assertion and leak scan after all generating fixtures complete.

F4 `advisory` — D5’s command evidence does not verify its “cross-platform by construction” claim: one host executing the newly added validator cannot establish behavior on both Windows and POSIX.
Fix: Remove that claim from D5 or add platform-independent path fixtures that exercise the validator’s file resolution.

F5 `advisory` — The declared S sizing test is inaccurate: the plan changes the index module, the repository validator, setup documentation, and manifests, while introducing user-visible warning behavior.
Fix: Describe the S override honestly as a tightly bounded cross-file maintenance change, or reclassify it as M; this does not alter the implementation decisions.

Blind re-score:

1. Considered — `Purpose & typical use`.
2. Considered — `Design › Permissions`, D2.
3. Considered — `Design › Data`, D1–D4.
4. Considered — `Business rules`, D1–D3.
5. Considered — `Interfaces › Internal`, D1–D6.
6. Considered — `Interfaces › External`, D3 and D5.
7. Considered — `Design › States`, D2; F2 is a decision-free clarification.
8. Considered — `Use cases › Minimal stretch`, D1 and D2.
9. Considered — `Use cases › Maximal stretch` plus `Design › States`, D2 and D3; F3 is implementation work.
10. Considered — `Security`, D1, D3 and D6.
11. Considered — `Design › UX`, D2.
12. Considered — `Failure & observability`, D2–D4.
13. Considered — `Performance`, D3.
14. Considered — `Rollout`, D5; 14.3 is explicitly argued and preserves already-written README data.
15. Considered — `Out of scope`.

15/15 layers · 45/45 probes
VERDICT: READY
### Dispositions
- F1 · accepted · D1 prohibition scoped to the start of the footer path, matching the whole-path rule
- F2 · accepted · 7.1 states the missing-README case: stale, existing message, not legacy
- F3 · accepted · D3: renders are accumulated centrally and scanned after every fixture has run
- F4 · accepted · D5 drops the cross-platform claim; the validator addition is plain Node path resolution
- F5 · accepted · sizing sentence rewritten as a bounded cross-file maintenance change kept at S
