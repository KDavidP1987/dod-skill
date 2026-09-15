# Audience example — one question, four levels

The same question from a real plan (`index-leak-guard`, probe 10.2 — the store's footer path is
interpolated into the generated index) written at each of the four levels in `references/audience.md`.
The reader's technology for every sentence here is Markdown/Node.js; the decision, the recommendation and
the terms of art are identical in all four. Only the wording moves.

Use this file two ways: as the model's reference for what each level sounds like, and as a checklist —
`## What must be identical` — that a maintainer ticks before any dod release (CONTRIBUTING.md).

## expert

**10.2 — Injection.** The footer interpolates the store path into a Markdown code span. A directory name
containing a backtick, a newline or a C0/C1 control character would terminate the span or corrupt the
generated README.

Recommendation: escape backticks to `'` and replace control characters, line separators and Unicode
format characters with a space before interpolation; assert it in the selftest with a hostile directory
name. Taken: the footer is inert for any directory name. Not taken: a hostile store path can break the
index layout and hide a leak behind a malformed span.

## working

**10.2 — Injection.** The footer interpolates the store path into a Markdown code span — which means the
directory name becomes part of the generated README's text. A directory name containing a backtick, a
newline or a C0/C1 control character would terminate the span or corrupt the generated README.

Recommendation: escape backticks to `'` and replace control characters, line separators and Unicode
format characters with a space before interpolation; assert it in the selftest with a hostile directory
name. Taken: the footer is inert for any directory name. Not taken: a hostile store path can break the
index layout and hide a leak behind a malformed span.

## familiar

**10.2 — Injection.** The footer interpolates the store path into a Markdown code span — here, that means
the directory name is pasted into the README between two backticks, and Markdown treats everything up to
the next backtick as the span. A directory name containing a backtick, a newline or a C0/C1 control
character would terminate the span or corrupt the generated README — here, that means a folder name
alone could change how the rest of the file renders.

Recommendation: escape backticks to `'` and replace control characters, line separators and Unicode
format characters with a space before interpolation — here, that means the name is cleaned before it is
pasted, so nothing in it can end the span early; assert it in the selftest with a hostile directory name —
here, that means the test suite keeps proving it on every run. Taken: the footer is inert for any
directory name — here, that means no folder name can affect the README. Not taken: a hostile store path
can break the index layout and hide a leak behind a malformed span — here, that means an odd folder name
could garble the index and make a leaked path harder to spot.

## new

**10.2 — Injection.** The index file ends with a line that says where the plans live. That folder name is
written between two backticks so it shows as code (a Markdown code span), and the name is copied in as-is
(interpolation). If the folder name itself contains a backtick, a line break, or an invisible control
character (a C0/C1 control character), it can end the code box early or corrupt the file. For example, a
store named `` docs`dod `` would close the span after `docs` and the rest of the line would render as
ordinary text.

Recommendation: clean the name before writing it — turn backticks into `'` and replace control
characters, line separators and invisible formatting characters (Unicode format characters) with a space
(escaping) — and keep a test with a deliberately nasty folder name so the cleaning is proved on every run
(a selftest assertion). If we do this, no folder name can affect the index. If we do not, a folder name
can break the index layout and hide a leaked path behind a malformed span.

## What must be identical

Tick each against the four versions above:

- [ ] The **decision** is the same in all four: escape backticks, replace controls / line separators /
      format characters with a space, before interpolation, with a selftest assertion.
- [ ] The **recommendation** is the same in all four and each version states **both consequences** —
      what happens if it is taken and if it is not.
- [ ] The same **terms of art** appear in all four: *interpolate*, *Markdown code span*, *C0/C1 control
      character*, *line separator*, *Unicode format character*, *escape*, *selftest*. `new` adds plain
      words before each and the term after; it removes none.
- [ ] Each version obeys **only its own level's rule** and carries **only its own gloss marker**:
      `expert` has none of `— which means`, `— here, that means`, `For example,`; `working` has
      `— which means` once, on the specialised term, and nothing else; `familiar` has `— here, that
      means` after each term and neither of the other two; `new` has the term in brackets and
      `For example,` and neither of the other two.
- [ ] Nothing else differs: the probe number, the heading, the order of the sentences.
