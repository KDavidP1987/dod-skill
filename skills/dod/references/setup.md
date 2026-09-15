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
  profile.md       optional: project-wide N/A layers with reasons, extra probes (see layers.md)
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
(the model reads frontmatter directly), the index is not regenerated, and the `--check` invariants are not
verified. `ready` and `done` remain possible only if the user explicitly accepts that: walk the
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
  node       v22.20.2
```

The `store` line's `index fresh` comes from `dod-index.mjs --check-index`. The index footer (`Store: \`docs/dod\``) is a
path *relative to the working directory* by contract — never absolute. An absolute path there is a leak of the
developer's filesystem layout into a committed file (dod ≤ 0.1.2 wrote one); `--check-index` and `--check <slug>` name it
(`index footer carries an absolute path — regenerate with dod-index.mjs`) and the remedy is to regenerate the index. A
`README.md` that is a symlink is followed in this version — the store's README is written through it; the v0.2 epic
(realpath-resolved store, atomic writes) removes that.
