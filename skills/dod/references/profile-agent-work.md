# Profile pack — work handed to agents

Five probe additions for a project where the building is done by agents rather than by the person who
wrote the plan: a subagent, a delegated session, a scheduled run, a teammate reading only the plan file.
They are **opt in**. Nothing here changes how a plan is scored until you paste a clause into your own
`docs/dod/profile.md`; a project that builds everything in one session needs none of them.

Each clause extends one probe from `layers.md`, keeps that probe's number, and is written so you can paste
the bullet into `profile.md` under `## Added probes` unchanged. Add the ones your project has been bitten
by, not all five.

## 5.1 — a brief is an interface

```markdown
- 5.1 (agent work) A brief handed to another agent is an internal interface: name what it must contain —
  the paths, the revision, the acceptance command — and what the receiver may not assume. A step that says
  "delegate this" without stating the brief's contents is a Gap.
```

The receiving agent sees the brief and nothing else. Everything the plan knows and the brief omits is
knowledge that does not survive the handoff, which is the same failure as "as discussed" in a Build plan.

## 3.2 — facts about artifacts that do not exist yet

```markdown
- 3.2 (agent work) For every output an agent is asked to produce, say how the plan will be checked against
  it before it exists: the path it will be written to, the shape a reader can verify, and what makes it
  wrong. A statement about an artifact nobody can open yet is a claim, not an input.
```

Plans for agent work are full of sentences about files that will exist later. The probe forces each one to
name where it will land and how a reader tells a correct one from a plausible one.

## 6.3 — truths that hold only at a revision

```markdown
- 6.3 (agent work) Any fact read out of the tree — a symbol, a path, a schema, a line number — is recorded
  with the revision it was read at, and the plan says what to do when the revision has moved: re-read, or
  treat the difference as an amendment.
```

An agent that starts hours later reads a different tree. Without the revision, a stale fact and a current
one look identical in the plan.

## 9.2 — edits applied by a re-runnable script

```markdown
- 9.2 (agent work) An edit an agent will apply to source is described as a script that can be re-run: the
  exact anchor it matches, what happens when the anchor is missing or matches twice, and how a half-applied
  run is undone. "Update the handler" is a Gap.
```

Re-running is the normal case, not the exception: a failed run, a retry, a second agent on the same task.
An edit that is only safe once will be applied twice.

## 12.4 — a gate record a machine produced

```markdown
- 12.4 (agent work) The evidence that a gate passed is a record a machine wrote — an exit code, a saved
  output file, a log line with the revision — not an agent's sentence that it ran. Name the command and
  where its output is kept.
```

"I ran the tests and they passed" is the single most expensive sentence in delegated work. This probe asks
for the artifact that would still exist if the agent were wrong.
