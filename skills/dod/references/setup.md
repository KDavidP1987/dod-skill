# Setup — the store, the pointer, the hooks

`setup` is a procedure the model performs — there is no setup script in this version. It is idempotent:
run it once per project, or again to change the trigger policy. It never edits a file without showing
the exact block first, and every edit is one of the exact operations below. Read this file before `setup`.

Flags: `--auto-trigger` / `--manual` set the policy sentence; `--remove` deletes the block; `--hooks`
installs the session-start hook (Claude Code); `--git-hook` offers the pre-push index check; `--check`
reports without changing anything.

## 1. The store

```
docs/dod/
  README.md        generated index — marker line on top, never hand-edited
  profile.md       optional: project-wide N/A layers with reasons, extra probes (layers.md); the
                   `## Audience` section — the reader's level per technology (audience.md, §3b below)
  <slug>.md        one plan per item (plan-template.md)
  <slug>.reviews.md
```
Create `docs/dod/` and generate the index immediately (`node <skill>/scripts/dod-index.mjs --dir <store>`)
so it carries the marker; without Node, write no README at all rather than an unmarked placeholder. If the project keeps docs elsewhere (`doc/`, `documentation/`),
ask once and record the chosen path as the `dod-store:` line in the pointer block — the script reads
that line when `--dir` is not given, so every generated command and hook must also pass `--dir <path>`.

## 2. The pointer block — how a project remembers its plans

Skills load per session; plans on disk do not announce themselves. The one file every agent host loads
on every session is the project's instructions file. `setup` installs a marked block there:

| Host | File (project scope) |
|---|---|
| Claude Code | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| Cursor | `.cursor/rules/dod.mdc` (or `AGENTS.md` if the project already uses one) |

Detect the candidates that exist. If more than one does, list them with their scope and ask which to use
(or "all"). Never guess between a root `CLAUDE.md` and a nested one.

```markdown
<!-- dod:begin v1 -->
## Definition of Done plans
dod-store: docs/dod
Plans live in the store above (index: `README.md` there). Before building anything that has a plan there,
read the plan and follow its `## Build plan`; check items only with evidence; record anything the plan
did not foresee as an amendment before building it; never edit `## Baseline`. Before claiming a feature
is finished, run the `dod` skill's `status` on it. Trigger policy: manual — plan with `dod` only when
the user asks for it.
<!-- dod:end -->
```

With `--auto-trigger` the last sentence becomes:
> Trigger policy: auto — when the user asks to plan, design, or build a feature or function in this
> project, use the `dod` skill to plan it first unless they decline.

`--manual` rewrites the sentence back. Removal (`setup --remove`) deletes exactly the text between the
markers, including the markers, and nothing else; if the markers are missing or duplicated, stop and tell
the user to resolve it by hand. Re-running `setup` on a file that already has the block replaces the
block's content in place (same rule: exactly the text between the markers).

This is best-effort policy: it works when the host loads the file and the model follows it. It does not
change the skill's own frontmatter. `setup --check` reports which files carry the block, which policy
each states, and whether hooks are installed.

## 3b. The audience question — asked once per project

After the pointer block, `setup` asks how technical the reader is, per technology, so that questions and
plans are worded at their level (`references/audience.md` has the rules; read it first). Scan the
repository for technology markers (`package.json` → Node.js, `pyproject.toml` → Python, `*.css` → CSS,
`Cargo.toml` → Rust, `go.mod` → Go, `Gemfile` → Ruby, `composer.json` → PHP, `pom.xml` → Java, `*.csproj`
→ C#, `Dockerfile` → Docker, `.github/workflows/*.yml` → GitHub Actions, `*.tf` → Terraform, `mix.exs` →
Elixir, `pubspec.yaml` → Dart, and whatever else the tree plainly shows), list them **alphabetically by
name, at most 12 per question** (more → consecutive questions of at most 12; each accepted batch is written
before the next is asked), and ask — this text verbatim, one row per line, never a table, no line over
120 columns:

```
How comfortable are you with each of these? It changes only how I word questions and plans — never what
they decide. Levels:
  expert    — I use the terms, no explanations
  working   — I know it; explain only the specialised terms
  familiar  — I follow it; tell me what each term means for the decision
  new       — plain words first, the term after, with an example
Technologies I found:
  CSS
  Python
Answer with `all <level>`, or one per line like `Python expert`, plus optional `default <level>` and
`who <role>`. `skip` leaves it unset for now. This is written to docs/dod/profile.md and committed with
the repository (a role, a date and these levels — never a name); say `keep it out of git` and I will add
the .gitignore line instead.
```

A scan that finds nothing still asks, with `  none yet` as the list. **Every accepted answer writes a
complete section** — `who`, `default`, `asked` (today's local date) and one row for every technology
listed (none for `none yet`) — so nothing listed is ever asked again:

- `all <level>` → `- default · <level>` and every listed technology at `<level>`
- `<technology> <level>` (one or more, comma- or line-separated) → those rows at their levels; every
  other listed technology at the default
- `default <level>` → the `default` line (and the level of every listed technology not named
  individually); without it, `default · working`
- `who <role>` → the `who` line; without it, `who · project owner`
- `skip` → nothing written; wording stays at `expert` for this session; asked again at the next `plan`
- anything else → show the forms once more; a second unusable answer is `skip`
- `keep it out of git` → add `docs/dod/profile.md` to `.gitignore` (shown first), then write as usual

Show the exact section **before** writing it — print the block below as a message, then make the tool call
that writes the file; never write first and show afterwards (the answer was the confirmation, so no second
"yes" is needed) — and write only that section:

```
Writing to docs/dod/profile.md (everything else in the file stays):

## Audience
- who · project owner
- default · working
- asked · 2026-09-15
- CSS · new
- Python · expert
```

If `profile.md` is a symlink, add `writing through symlink → <resolved path>` to the first line. Re-read
the file immediately before writing; replace exactly the span from `## Audience` to the next `## `
heading (or append the section at the end). Cancelling — `skip`, an empty answer, an interruption —
writes nothing. Then run `node <skill>/scripts/dod-index.mjs --profile --dir <store>` and confirm in one
line: `audience recorded: default working · 2 technologies`. If the write fails part-way (it is one
whole-file write, not atomic), say so: `--profile` reports the damage and `git checkout --
docs/dod/profile.md` or re-running `setup` repairs it.

Privacy: `who` is a role, never a name or an e-mail. The levels are committed to the repository and stay
in its history like any other file; offer the `.gitignore` line when that is not wanted. Re-running
`setup` shows the current rows, asks again, rewrites the section in place, and offers to drop rows for
technologies the scan no longer finds — never silently.

## 3. Hooks — so every session opens with the open items in view

**Claude Code** (`.claude/settings.json` in the project, verified against Claude Code 2.1.x):
```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command",
          "command": "node \"<ABSOLUTE PATH TO>/skills/dod/scripts/dod-index.mjs\" --brief" } ] }
    ]
  }
}
```
Merge into an existing `hooks.SessionStart` array; do not replace it — show the resulting JSON before
writing. If the skill is installed as a plugin, the path is the plugin's install path instead — `setup`
resolves the path of the script it is running from and writes that. Add `--dir <path>` when the store is
not `docs/dod`. The `--brief` output is one or two lines:
`dod: 2 open — export-csv in-progress 7/12 · audit-log ready 0/9 · index stale (run dod-index)`.

**Codex / Cursor:** no session-start hook was available when this was written (2026-09-14). Check the
host's current docs before claiming otherwise; until one exists the pointer block carries the load, and
`setup --check` says so plainly.

**Git (optional, `--git-hook`):** a `pre-push` hook that runs `dod-index.mjs --check-index` and fails
the push when the index is stale. Offered, never installed silently.

## 4. Without Node

`dod-index.mjs` needs Node 20+. If `node --version` fails, `setup` says so: `list` and `status` still work
(the model reads frontmatter directly), the index is not regenerated, the `--check` invariants are not
verified, and the `## Audience` section is read directly with the note that its grammar was not checked
(a section that does not parse by eye counts as no valid level → `expert` wording). `ready` and `done` remain possible only if the user explicitly accepts that: walk the
readiness / closure checklist aloud with them, ask "the script did not run — proceed?", and write their
answer into the transition's log line as `· unverified by script · accepted by <user>`. No answer, no
transition. Do not pretend otherwise.

## 5. `setup --check` output

```
dod setup — project: /path
  store      docs/dod/  (3 plans, index fresh)
  pointer    CLAUDE.md  · policy: manual · v1
             AGENTS.md  · missing
  hooks      claude SessionStart · installed
             codex / cursor · not available on this host
  audience   default working · 4 technologies · asked 2026-09-15
  node       v22.20.2
```

The `audience` line is `--profile`'s summary; without a section it reads `audience   not set`, and a
malformed section prints its `✗ audience:` problems under it.

The `store` line's `index fresh` comes from `dod-index.mjs --check-index`. The index footer (`Store: \`docs/dod\``) is a
path *relative to the working directory* by contract — never absolute. An absolute path there is a leak of the
developer's filesystem layout into a committed file (dod ≤ 0.1.2 wrote one); `--check-index` and `--check <slug>` name it
(`index footer carries an absolute path — regenerate with dod-index.mjs`) and the remedy is to regenerate the index. A
`README.md` that is a symlink is followed in this version — the store's README is written through it; the v0.2 epic
(realpath-resolved store, atomic writes) removes that.
