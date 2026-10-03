# dod roadmap

What is decided for the next versions of dod, and nothing else. There are no dates: a version ships when its
own plan closes, and every plan named below is a dod plan in the lab that builds dod. The short version is in
the [README](README.md#roadmap).

## Shipped

- **0.3.2 — the public launch.** The five pages in one look (the plan page, the review page, the project
  dashboard, the self-audit and the cross-project benchmark), measured effort per work package, a short-or-full
  detail preference beside the reading levels, and the fixes reported from real use.
- **0.3.0 — sharper probes.** Seven planning questions reworded where finished plans showed they let a gap
  through; the "Plan feedback" and "Field audit" issue forms.
- **0.2.0 — rubric 2.** Forty-nine probes and nine gating, the work-breakdown view, the reading levels, the
  opt-in feedback loop.
- **0.1 — the first release.** Fifteen layers, independent review, the frozen baseline, the prediction rate.

## Next

- `probe-fixes` — planning checks learned from field reports: a plan's parts that must add up to the whole, a
  reconciliation item that proves they do, look-alike items that should be one, and a list of field probes
  seeded from the reports so far.

## 0.4.0

- `cross-model-review` — a reviewer roster with a second opinion from another model family, so no plan depends
  on one model to check it.
- `scoring-rules` — the prediction rate falls only for gaps in the original plan: a reversal is sorted by its
  cause, and scope you chose to change never counts against the plan.
- `autonomy-hooks` — beside today's session-start line, a reminder when a session ends and an automatic audit,
  through the host's hooks; they only read and report, and never run a check or change a plan.
- `audit` — a command that re-checks every plan's rules, marks evidence stale when the files behind it changed
  later, and reports where a parent plan's numbers and its children's disagree.
- `enhance` — after a scope change you asked for, a command that writes proposed amendments into the plan's
  Proposed section and changes nothing else.

## 1.0 (under consideration)

The bar for 1.0 is named but not decided: the 0.4.0 work done, and dod used on projects outside SkillEra with a
prediction rate at or above the 75 % floor. Until both hold, dod stays below 1.0.
