# Audience — meet the reader where they are

A plan is read by a person who is technical but not fluent in every technology the product uses. The
`## Audience` section of `<store>/profile.md` records, once per project, how comfortable that reader is
with each technology, and these rules turn that into wording. Read this file before a question batch,
before writing a plan's prose sections, before `explain`, and before the audience question in `setup`.

The rules change **wording**. They never change a decision, a term, a D-item, a Build plan step, a
Coverage pointer, a Log line, or anything the reviewer receives.

## The section

```markdown
## Audience
- who · project owner
- default · working
- asked · 2026-09-15
- Python · expert
- HTML/CSS · familiar
- Postgres · new
- GitHub Actions · working · assumed
```

- `who` — a role, never a name or an e-mail; at most 80 characters. It tells a second reader whose level
  this is.
- `default` — the level for sentences about the product or the process as a whole, and for rows marked
  `assumed`. It never stands in for a technology that has no row (see *Which level applies*).
- `asked` — the date any row last changed, as the machine's local calendar date **at the moment the file
  is written** (`YYYY-MM-DD`, the same clock every other dod Log line uses — never UTC, never the date
  the session started).
- one row per technology — 1–40 characters, no ` · `, no line break; one row per name, compared
  case-insensitively. An optional ` · assumed` marks a row an autonomous plan wrote without asking.
- at most 500 technology rows; the file at most 1 MB.

`node <skill>/scripts/dod-index.mjs --profile [--dir <store>]` prints one line — `audience: default working ·
4 technologies · asked 2026-09-15`, or `audience: not set — run setup` — and lists every grammar problem
as `✗ audience: …` with exit 1. Run it after every write to the section. If it does not return within
30 seconds, stop waiting, say `audience: --profile did not complete in 30 s — section not checked`, and
treat the section as unreadable (effective level `expert`, below) — never hand-parse it as a substitute.

## Levels

Each level has exactly one wording rule and, below `expert`, one fixed **gloss marker** — a phrase that
makes the level's output recognisable, so a grep can tell whether the rules were followed.

| Level | Rule | Marker |
|---|---|---|
| `expert` | Terms of art bare. No glosses, no appended consequences. Byte-for-byte the skill's wording before the profile existed. | none of the three phrases below |
| `working` | Terms bare, but a term *specialised to this technology* (not general programming vocabulary) gets one clause the first time it appears in a document or a batch. | `— which means …` |
| `familiar` | Every term of art is followed by its consequence *for this decision*, in plain words. | `— here, that means …` |
| `new` | Plain words first, the term in brackets after; one concrete example per decision. | the term in brackets, and `For example, …` |

The same sentence at the four levels (the decision is probe 10.2 of `index-leak-guard`):

- `expert` — The footer path is interpolated into a Markdown code span; escape backticks and strip C0/C1 controls before interpolation.
- `working` — The footer path is interpolated into a Markdown code span — which means the path becomes part of the generated README text — so escape backticks and strip C0/C1 controls before interpolation.
- `familiar` — The footer path is interpolated (inserted as text) into a Markdown code span — here, that means a directory name can end the span early and break the README's layout — so backticks are escaped and control characters stripped before it is inserted — here, that means a hostile folder name can never change what the rest of the file looks like.
- `new` — The store's folder name is written into the generated README inside a small code box (a Markdown code span). A folder name containing a backtick or an invisible control character could break out of that box and garble the file. For example, a folder named `` docs`dod `` would end the code box early. So the name is cleaned first (backticks escaped, control characters removed — "escaping").

`tests/audience-example.md` holds a full question at all four levels with the checklist that proves they
differ only in wording.

## Which level applies

- A sentence is worded at the level of **the technology it is about**.
- A sentence about the product or the process as a whole (the plan's purpose, the lifecycle, the rubric)
  uses `default`.
- A sentence spanning two technologies uses the **lower** of their levels.
- A technology the plan's recon touches that has **no row** is a question, never a lookup: ask about it
  once (see *The question*) before the question batch. `default` never stands in for it — except in an
  autonomous plan (see *Autonomous plans*).
- When no valid level exists at all (no section, `skip`, an unreadable or malformed section, a stalled
  `--profile`), the effective level is `expert` — the skill's wording before the profile existed. Say so
  in one line when the section is malformed or unreadable, with the `--profile` problems; never guess a
  level, never fall back to `working`.
- An explicit instruction in the session ("be terse today", "explain everything") outranks the profile
  for that session and is not written to the file. Precedence: session instruction › the technology's row
  › (product/process sentences and assumed rows) `default` › `expert`. The profile outranks your own
  judgement of the reader; only the owner changes a level, by `setup` or by editing the file.
- Use the technology name already in the profile when the recon finds it under another name (`JS` for a
  `JavaScript` row). Aliases are distinct rows to the parser; do not create a second one.

## Where it applies

Question batches (the question, *why it matters*, the recommendation) · the inline plan summary shown
after drafting · `## Purpose & typical use` · `## Use cases` · `## Assumptions` (statements and fallbacks)
· `## Also considered` · an amendment's `why` text · the close conversation (excluded amendments, the
rate) · the report's missed-probes explanation · the restatement of reviewer findings when showing
dispositions.

## Where it never applies

D-items (the `## Definition of Done` lines) · `## Build plan` steps · `## Coverage` pointers · `## Log`
lines · `## Baseline` · the reviewer prompt and everything the reviewer receives · the rubric · the
grammar of any section the script parses. These are executed by agents and checked by the referee: a
gloss there is a grammar error, and the script will report it.

**D-item titles are the one exception inside a D-item.** At `dod: 2` each item begins with a `**title**`
(plan-template.md › ID legend): a label of at most 40 characters, worded at the reader's level for the
item's technology, so a person can tell `D5` from `D6` without reading the statement. The title is never
parsed as grammar and changing it is not an amendment. The statement after it stays grammar — never
glossed, never simplified to match the title.

## Precision never drops

Every term that would appear at `expert` still appears at every other level. The levels **add** a clause,
a consequence or an example; they never remove a term, replace it with a vaguer one, or change the
decision. If a plain restatement would change the meaning, the restatement is wrong, not the term.

## Recommendations

A recommendation is never shown bare. At every level, including `expert`, it carries in plain words:
what happens if it is taken, and what happens if it is not (or if the alternative is chosen). A reader
who cannot evaluate a recommendation is not deciding; they are signing. Below `expert`, the two
consequences follow the level's rule like any other sentence.

End every question batch with one sentence: *say `explain <n>` for any of these.*

## The question

Asked once per project by `setup` (after the pointer block) or by the first `plan` in a project whose
`profile.md` has no `## Audience` section, and again — for the unrated technologies only — when a plan's
recon touches a technology with no row. List the technologies the repository scan or the recon actually
found, **alphabetically by name**, at most **12 per question**; more than 12 pending → consecutive
questions of at most 12 until every pending technology is rated. Never proceed with `default` for a
touched technology. A scan that finds nothing still asks: the list reads `  none yet`. Text, verbatim
(one row per line, never a table, no line over 120 columns, so it reads in order and wraps between rows):

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

Answer forms and what each writes — **every accepted answer writes a complete section: `who`, `default`,
`asked` (today), and one row for every technology listed in the question** (none when the list was
`none yet`), so nothing listed is ever asked again:

| Answer | Writes |
|---|---|
| `all <level>` | `default · <level>`; every listed technology at `<level>` |
| `<technology> <level>` (one or more, comma- or line-separated) | those rows at their levels; every other listed technology at the default |
| `default <level>` | the `default` line; every listed technology not named individually at `<level>`; without it, `default · working` |
| `who <role>` | the `who` line; without it, `who · project owner` |
| `skip` | nothing; effective level `expert` for this session; asked again at the next `plan` |

So `Python expert, CSS new` writes `default · working`, `Python · expert`, `CSS · new`; `default familiar`
alone writes `default · familiar` and every listed technology at `familiar`; `all expert` writes
`default · expert` and every listed technology at `expert`. An answer in none of these forms → show the
forms once more; a second unusable answer is `skip`. `keep it out of git` adds `docs/dod/profile.md` to
`.gitignore` (shown before writing) and then writes the section as usual.

Show the exact section (or, for the one-technology re-ask, the exact row) before writing it. If
`profile.md` is a symlink, say `writing through symlink → <resolved path>` on the same line. Write only
the span from `## Audience` to the next `## ` heading (or append the one row inside it), re-reading the
file immediately before the write; everything else in `profile.md` is untouched. The write is one
whole-file write by your file tool and is not atomic: if it fails part-way, say so, and tell the owner
that `--profile` will report the damage and that `git checkout -- docs/dod/profile.md` or re-running
`setup` repairs it. Then run `--profile`. Confirm in one line: `audience recorded: default working ·
2 technologies`.

Multi-batch questions persist **per accepted batch**: the first accepted batch writes the whole section,
each later one appends its rows and updates `asked`; an interruption keeps the accepted batches and the
next `setup` or `plan` lists only the technologies still unrated. Planning does not start until every
batch is answered.

Re-running `setup` shows the current rows, asks again, and rewrites the section in place; it offers to
drop rows for technologies the scan no longer finds and never drops one silently. "Once" means once per
listed technology: a later plan that touches a technology the scan never listed asks about that one
technology, one row, and never again about a rated one.

## explain

`explain <Dn | An | Fn | question n>` restates the target **one level plainer** than its technology's
level (`expert` → `working`, `working` → `familiar`, `familiar` → `new`, `new` → `new` with a second
example), with one concrete example, in the conversation only. It changes no file and adds no Log line.
It works on any plan, including ones written before the profile existed. `Fn` means the latest review's
finding; `question n` the last batch shown in this session. A target that matches nothing, or is
malformed, changes nothing and returns one line — `explain: nothing matches "<target>" — valid targets:
D1–D14, A1–A2, F1–F9 (review 6), question 1–8` — listing only identifiers that exist in this plan and
session. Never guess.

## Autonomous plans

`plan --autonomous` never asks the audience question. A technology the recon touches that has no row is
treated as `default`, appended as `- <technology> · <default level> · assumed`, and named in one Log note:
`- <date> · note · audience assumed for <technologies>` (comma-separated). The next interactive `plan` or
`setup` asks about the `assumed` rows before anything else and rewrites them without the marker.
