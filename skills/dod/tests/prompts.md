# Trigger tests — dod

Run each prompt in a **fresh** session with the skill linked (`npm run link -- dod`). Record what
happened. Non-interactive form used for the rows below:
`claude -p "<prompt>" --max-turns 2 --output-format stream-json --verbose > out.jsonl` and
`grep -c '"skill":"dod"' out.jsonl` (1 = triggered, 0 = quiet) — for a prompt that begins with `/dod`, the host expands the skill itself and emits no Skill call, so read the first tool call instead: it must be the skill's own first step (its `dod-store:` lookup or a read under `skills/dod/`). Rows without a date are untested. The skill is ready when every row matches. The skill is explicit-only by design, so the
should-NOT table is the more important half.

## Should trigger

| Prompt | Triggered? | Notes |
|---|---|---|
| "/dod plan the CSV export for invoices" | yes | 2026-09-14 · `claude -p`, fresh session · `Skill(dod, "plan the CSV export for invoices")` was the first tool call |
| "Write a definition of done for the notifications feature before we build it" | yes | 2026-09-14 · tested as "I need a definition of done for the password reset flow before we start" · `Skill(dod)` first call |
| "What does done actually mean for the audit-log function? Cover the cases I haven't thought of." | | |
| "/dod status export-csv" | | |
| "Close the DoD for export-csv and give me the report" | | |
| "/dod setup --auto-trigger" | | |
| "/dod setup" in a project with no `## Audience` section (asks the audience question once, then writes it) | | audience-profile D4 |
| "/dod explain D2" on an open plan (restates one item a level plainer; no file changes) | | audience-profile D6 |
| "How technical should you be with me on this project?" (should run `setup`'s audience question) | | |
| "/dod status plan-readability" (every id's first mention in each message carries its title or meaning — plan-readability D14) | yes | 2026-09-19 · Windows 11, Claude Code 2.1.278, `claude -p` in a fresh session on a temp clone of the lab (skill already junctioned; read-only tools + the dod script) · run 1: final reply clean but one progress message said "D1–D12" bare → **fail, 1**; SKILL.md rule widened to progress notes and ranges · run 2 (stream-json, all 7 messages read): **0 bare first mentions → pass** |
| "Show me the work breakdown of the dod plans in this project as a tree" | yes | 2026-09-21 · Windows 11, Claude Code 2.1.278, `claude -p` in a fresh session from an empty directory under the OS temp folder (`MSYS_NO_PATHCONV=1`, skill junctioned into `~/.claude/skills`) · first tool call `Skill(dod, "show work breakdown of the dod plans in this project as a tree")` · log `trigger-logs/2026-09-21-wbs-tree.jsonl` |
| "/dod page wbs-view --review" | yes | 2026-09-21 · Windows 11, Claude Code 2.1.278, `claude -p` in a fresh session from an empty directory under the OS temp folder (`MSYS_NO_PATHCONV=1`, skill junctioned into `~/.claude/skills`) · a typed slash command: the host expanded the skill into the turn and emitted no Skill call; the first tool call was the skill's own store recon `ls -la && (grep -rn "dod-store:" CLAUDE.md AGENTS.md …; ls docs/dod …)` (release-0-2 A6) · log `trigger-logs/2026-09-21-page-review.jsonl` |
| "/dod amend wbs-view emergent the reviewer found the temp dir survives a crash" | yes | 2026-09-21 · Windows 11, Claude Code 2.1.278, `claude -p` in a fresh session from an empty directory under the OS temp folder (`MSYS_NO_PATHCONV=1`, skill junctioned into `~/.claude/skills`) · expanded the same way, no Skill call; the first tool call read `references/lifecycle.md` and looked for the store and an instructions file, as SKILL.md says `amend` must (release-0-2 A6) · log `trigger-logs/2026-09-21-amend-emergent.jsonl` |

## Should NOT trigger (or: loads but does not run, and does not interrupt)

| Prompt | Stayed quiet? | Notes |
|---|---|---|
| "Make a plan for adding dark mode" (ordinary plan request, no DoD wording, no auto policy) | yes | 2026-09-14 · tested as "Can you write me a plan for adding a CSV export to the invoices page?" · went straight to reading the project; no Skill call |
| "Mark the checkout task as done in the tracker" (task management) | yes | 2026-09-14 · tested as "Add a done checkbox to each todo item in this list app" · no Skill call |
| "What is Definition of Done in Scrum?" (concept question, nothing to plan) | yes | 2026-09-14 · answered the concept directly; no Skill call |
| "Build the export function" (wants code) | | |
| "Fix the typo in the header" (smaller than S) | | if invoked explicitly on this, must say it is too small and stop |
| "claudex this plan" (a different skill) | | |
| "/dod plan --autonomous <request>" in a project whose profile lacks a touched technology (must NOT ask the audience question; writes a ` · assumed` row and a Log note) | | audience-profile D11 — "quiet" here means no audience question |

## Auto-trigger policy

With a `dod:begin` block whose policy is `auto` in the project's `CLAUDE.md`:

| Prompt | Ran dod? | Notes |
|---|---|---|
| "Plan the dark-mode feature" | | should run `plan` |
| "Fix the typo in the header" | | should still stop as too small |

## Quality checks

Once triggered on `plan`:
- Did recon cite paths for what it read, and ask nothing the code answered?
- Did every question carry a probe reference, why-it-matters, and a recommendation?
- Was every N/A row accompanied by the applicability test performed?
- Did the DoD come first, with `Dn` IDs and evidence types, and did every Considered layer 2–14 map to
  at least one item?
- Was an independent reviewer actually run (or the human rubric asked), with the review written to
  `<slug>.reviews.md` and not the plan?
- Did the plan refuse `ready` while a `decision-required` assumption existed?
- Does `node <skill>/scripts/dod-index.mjs --check <slug>` pass on the written plan?
- With an `## Audience` section: were the question batch and the plan's prose sections worded at the
  reader's level per technology, with every recommendation carrying both consequences — and were the
  D-items, Build plan, Coverage and Log lines free of gloss markers (`which means`, `here, that means`,
  `For example,`)? Did an unrated technology the recon touched get asked about once, before the batch?

Once triggered on `close` with an unverified item: did it refuse and list the item?
