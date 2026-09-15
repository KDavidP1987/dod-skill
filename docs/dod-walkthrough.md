# Walkthrough — one plan, start to finish

This is the record of the first plan this repository took through the whole `dod` lifecycle:
[`index-leak-guard`](dod/index-leak-guard.md), an `S`-sized change to the skill's own helper script.
Nothing here is staged. The plan, its five review rounds and its close are all in `docs/dod/`, and every
commit named below is on `main`.

The point of reading it is not the feature. It is to see what the artifacts look like when the skill is
used honestly — including a prediction rate that came in *under* target, and what that number turned out
to mean.

## 1. The finding that became a plan

On 2026-09-14, while dogfooding, the generated index `docs/dod/README.md` was found to carry the store's
**absolute path** in its footer — the developer's home directory, in a committed file, in a public repo.
Commit `6e3fd94` changed the footer to a working-directory-relative path. That fixed the symptom. Nothing
yet *guarded* the contract, and a README committed by an older version would carry the old footer until
someone regenerated it.

Request, as written into the plan:

> guard the generated index against leaking absolute paths: a test that fails if the footer ever goes
> absolute again, a warning when a committed README still has the old footer, and a leak scan of the
> generated files.

## 2. Draft — revision 1

The skill sized it `S`, read the script and the existing selftest, recorded the commit it read
(`2c84222`), and drafted `docs/dod/index-leak-guard.md` with six Definition-of-Done items:

| | Item | Evidence |
|---|---|---|
| D1 | `renderIndex` never emits an absolute path — relative posix path, `.` for the working directory, a no-path sentence for a store on another root, one escaping rule for the interpolated path | `test` — selftest case `index-relative` |
| D2 | `--check-index` and `--check <slug>` warn `index footer carries an absolute path — regenerate with dod-index.mjs` on a legacy footer | `test` — selftest case `index-legacy-footer` |
| D3 | The selftest scans everything it renders for the home directory, the temp directory and a per-run secret | `test` — selftest case `leak-scan` |
| D4 | Summary line gains `index-relative=true legacy-footer=true leak-scan=true` | `cmd` |
| D5 | Versions 0.1.3 / 0.2.3, both validators pass, a `--check-versions` flag proves the manifests agree | `cmd` |
| D6 | `setup.md` states the footer contract and its remedy | `manual` 4/4 |

Author's coverage claim: `15/15 layers · 45/45 probes`. The referee script (`--check`) passed. Then the
plan went to review — with that coverage line blanked.

## 3. Review — five rounds with Codex

Codex CLI (`codex exec -s read-only`) received the rubric, the layer definitions and the score-redacted
plan, never the previous rounds. Each round's findings were dispositioned in
[`index-leak-guard.reviews.md`](dod/index-leak-guard.reviews.md) and applied as a new revision.

| Round | Reviewer's line | Blocking | Advisory | What the blocking findings were |
|---|---|---|---|---|
| 1 | 12/15 · 41/45 | 3 | 6 | 2.1/10.1 no trust boundary named; 4.4 no precedence or exception authority; 10.2 the footer path reaches Markdown unescaped |
| 2 | 11/15 · 41/45 | 3 | 4 | a store on another Windows drive makes `path.relative` return an absolute path; the *unreadable* README path was missing; no size or encoding policy for the untrusted README |
| 3 | 14/15 · 44/45 | 1 | 4 | `crypto.randomBytes` was a new dependency with no failure behaviour |
| 4 | 14/15 · 44/45 | 1 | 4 | two contradictory rollback procedures — a contradiction revision 3 had introduced |
| 5 | **15/15 · 45/45** | 0 | 5 | — `VERDICT: READY` |

Two things worth noticing. The reviewer's coverage line went *down* in round 2 as the plan got better:
round 1's fixes exposed probes the first draft had glossed. And half the blocking findings from round 3
onward were contradictions the author's own revisions had introduced while fixing earlier findings —
the design log calls this the revision-hygiene problem, and it is why the skill caps rounds at three by
default and presents the plan to a human when the cap is reached. Here the owner said "proceed", round 4
and 5 ran, and READY came with five advisories, all decision-free.

## 4. Approve

Round 5's advisories were applied as clarifications. Then `approve`: the six items were copied verbatim
into `## Baseline`, the frontmatter got `baselined: 2026-09-15`, `review: codex` and the reviewer's own
coverage line, and the Log recorded the transition:

```
- 2026-09-15 · status → ready · approve · review: codex
```

Commit `523b155`. From here on, the baseline cannot change; only amendments can.

## 5. Build

```
- 2026-09-15 · status → in-progress · start
```

The Build plan had four numbered steps, each naming the items it satisfied. Steps 1–2 (footer contract,
`legacyFooter`, wiring the warning) and step 4 (docs, versions, `--check-versions`) went as written.
Step 3, the selftest cases, is where the plan met reality — twice.

**Amendment A1.** While writing the leak-scan case, reasoning about how it would run on Linux CI: the
store under `/tmp/dod-selftest-x` renders a footer of `../../../../tmp/dod-selftest-x/docs/dod`, and that
*relative* string contains the *absolute* needle `/tmp/dod-selftest-x` as a substring. A plain substring
scan would fail on a correct footer — on CI only; Windows keeps its temp directory under the home
directory, where the same shape never occurs. Recorded before a line of the fix was written:

```
- A1 · 2026-09-15 · discovered · ~D3 · layer: 3.1 · on a POSIX host the store's `..`-relative footer …
  contains the temp directory's absolute path … as a substring, so a plain substring scan trips on a
  correct footer; the scan now counts an occurrence only where it begins a path (not preceded by `.`,
  `/` or `\`). The plan validated the needles as values but not the scanned text's shape
```

**Amendment A2.** With all three cases green, the selftest was run against three deliberate mutations of
a copy of the script: footer reverted to the absolute path, warning removed, home directory planted in
the title. The first mutation was caught by `index-relative` and `legacy-footer` — but **not** by
`leak-scan`. The mutated footer rendered `C:/Users/…` with posix separators; the needle was
`C:\Users\…`. Same root cause, same probe:

```
- A2 · 2026-09-15 · discovered · ~D3 · layer: 3.1 · … the needles' shape did not match the footer's;
  text and needles are now compared with both separators read as `/`
```

After the fix, the same mutation trips all three cases (`leaks: [ 'tmpdir', 'tmpdir_real', 'home' ]`).

One more thing surfaced that was *not* an amendment: the new `--check-versions` flag reported that
`SKILL.md` had been sitting at `0.1.1` through the `0.1.2` release — only `plugin.json` had been bumped.
A pre-existing defect outside this plan's DoD, fixed by D5's bump, recorded as a Log note.

Build commit: `0d2d93f`.

## 6. Status and close

`status` ran every item's evidence and wrote one line per item, each citing the commit it ran against:

```
- 2026-09-15 · D4 · pass · cmd: node skills/dod/scripts/dod-index.mjs --selftest → last line ends
  `index-relative=true legacy-footer=true leak-scan=true`, exit 0 · 0d2d93f · claude
- 2026-09-15 · D5 · pass · cmd: npm run validate (2 skill(s), 0 failing) && claude plugin validate --strict
  skills (✔ Validation passed) && node scripts/validate-skills.mjs --check-versions --plugin 0.2.3 --skill
  dod=0.1.3 (versions ok) && git diff --quiet 2c84222 -- README.md (exit 0) · 0d2d93f · claude
- 2026-09-15 · D6 · pass · manual: skills/dod/references/setup.md §5 — relative by contract ✓ · … — 4/4
  · 0d2d93f · claude
```

Six of six verified, no excluded amendments to confirm, so `close` wrote the report:

```
Report · 2026-09-15
Baseline items             6
Discovered (planning gaps) 2 amendments · 2 design changes · probes: 3.1 (2)
Requested scope changes    0
Defects / external         0
Prediction rate            6 / (6 + 2) = 75 %   target ≥ 90 %
Completion                 vs baseline 6/6 · vs current 6/6
Review                     codex · 5 rounds · author 15/15 layers · reviewer 15/15 layers
Timeline                   draft 09-14 · ready 09-15 · start 09-15 · done 09-15
Missed probes              3.1 input shape (2) — the leak scan's needles were specified as values, never as
                           text shapes …
```

Commit `ccad73d`. The regenerated index now reads
`3 plan(s) · 0 open · 1 done · prediction rate across done plans 75 %` and
`Most-missed layers — done plans: layer 3.1 (2)`.

## 7. What the number means

75 % is below the 90 % target, after five rounds of adversarial review that ended at 45/45 probes. The
temptation is to call the two amendments "implementation details" and keep the rate. The skill's rules
say otherwise, and the report is more useful for it:

- Both misses are the **same probe** — 3.1, *every input: shape, limits, validation*. The plan specified
  the scan's needles as values and never asked what shape the text being scanned would have. Five review
  rounds did not ask either. Two minutes of mutation testing did.
- That is a finding about the **probe**, not the builder. The report proposes the rule for
  `docs/dod/profile.md`: *for every scan or matcher, state the shape of the text it runs over, not only
  the values it looks for; prove it with a mutation.* If the next plans keep missing it, the index will
  show `layer 3.1` climbing, and the rule graduates into the project's profile.
- The plan also did what it was for: the six baseline items shipped exactly as frozen, every one with
  evidence, and a real leak of the developer's filesystem layout is now something the test suite refuses.

## 8. Reproduce it

```bash
git clone https://github.com/KDavidP1987/dod-skill && cd dod-skill
node skills/dod/scripts/dod-index.mjs --check index-leak-guard     # 6/6 verified, rate 75 %, exit 0
node skills/dod/scripts/dod-index.mjs --check-index                # dod index: fresh
node skills/dod/scripts/dod-index.mjs --selftest                   # … index-relative=true legacy-footer=true leak-scan=true
```

To see the referee refuse something, edit one character of D1 in `docs/dod/index-leak-guard.md` and run
`--check` again: `✗ D1 differs from ## Baseline without a ~D1 amendment`.
