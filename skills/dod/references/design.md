---
name: dod pages — Almanac
description: The one look of every page dod generates (plan, project dashboard, self-audit, benchmark), in the repository and as a Claude artifact.
colors:
  band: "#10293b"
  band-ink: "#eef2ee"
  band-muted: "#a9bfc6"
  ground: "#f4efe3"
  paper: "#fffcf4"
  ink: "#16222c"
  ink-muted: "#46525a"
  ink-faint: "#6b7479"
  rule: "#e2d9c4"
  rule-strong: "#c9bd9f"
  track: "#e9e1cc"
  tide: "#2f8fa8"
  link: "#1d5e79"
  focus: "#d0731f"
  ok: "#2f7a55"
  bad: "#b23a2a"
  tide-fill: "#2f8fa833"
  selection: "#bfe0e6"
  on-ok: "#ffffff"
  on-kind: "#ffffff"
  muted-bar: "#9aa9a6"
  kind-discovered: "#b5461f"
  kind-corrected: "#a7740c"
  kind-requested: "#2c7a6c"
  kind-emergent: "#6a4f9e"
  kind-defect: "#55636c"
  kind-external: "#73762a"
  dark-band: "#071119"
  dark-band-muted: "#8aa4ad"
  dark-ground: "#0d1a24"
  dark-paper: "#12222e"
  dark-ink: "#e6ebe6"
  dark-ink-muted: "#a9b6ba"
  dark-ink-faint: "#84939a"
  dark-rule: "#1f3443"
  dark-rule-strong: "#2f4a5c"
  dark-track: "#1b2f3d"
  dark-tide: "#5fb2c9"
  dark-tide-fill: "#5fb2c92e"
  dark-link: "#7cc6da"
  dark-focus: "#f0a050"
  dark-ok: "#5cb487"
  dark-bad: "#f07a66"
  dark-selection: "#24546a"
  dark-on-ok: "#06140d"
  dark-on-kind: "#0b1218"
  dark-muted-bar: "#56686f"
  dark-kind-discovered: "#ec8058"
  dark-kind-corrected: "#d9a63c"
  dark-kind-requested: "#58b5a3"
  dark-kind-emergent: "#a891e0"
  dark-kind-defect: "#93a3ad"
  dark-kind-external: "#b5b85a"
typography:
  display:
    fontFamily: "Sitka Heading, Sitka Text, Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Sitka Heading, Sitka Text, Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, -apple-system, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  label:
    fontFamily: "Bahnschrift, DIN Alternate, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.07em"
  numeral:
    fontFamily: "Bahnschrift, DIN Alternate, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  none: "0"
  tag: "2px"
  pill: "0.65rem"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  panel: "clamp(1rem, 3vw, 1.75rem)"
  section: "2.25rem"
components:
  header-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-ink}"
  tab-active:
    textColor: "{colors.band-ink}"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "{spacing.panel}"
  status-done:
    backgroundColor: "{colors.ok}"
    textColor: "#ffffff"
    rounded: "{rounded.tag}"
  change-mark:
    rounded: "{rounded.pill}"
    height: "1.25rem"
---

# dod pages — Almanac

Chosen by the owner on 2026-10-02 from two full samples built on field-fixes' real data (Impeccable,
Operate mode). Every page dod writes follows this file: the plan page, the project dashboard, the
self-audit, the cross-project benchmark, and any Claude artifact that shows the same content.

## Overview

A tide table, not a costume of one: a harbour almanac predicts and then records what happened. A dod
plan does the same, so the pages read as **predicted against observed**. The world lends four things
only — type, palette, density, and one signature move. Layout, navigation and controls are standard web
ones: a header with tabs, panels, tables with header rows, `<details>` to fold.

- **Fully offline.** No web font, no library, no fetched image, no request of any kind. System font
  stacks only; charts are inline SVG; one small inline script runs the tabs (with the hash) and nothing
  else. SVG `<title>` gives the hover labels. Without the script every panel shows, stacked.
- **Plain words first.** Each chart and table has a one-sentence heading line saying what it shows, and a
  "Show the numbers" fold with the same data as a table.
- **Every number traces to the plan file.** Measured values carry a `measured` tag; estimated ones say
  `estimated`; an absent value says "not recorded", never zero.

## Colors

- **Shell:** the navy band (`band`) holds the page identity and the tab row. Active tab: band ink plus a
  3 px `tide` underline.
- **Ground and paper:** warm buff ground, near-white panels with a 1 px `rule` border, no shadow.
- **Tide** (`tide`) is the colour of the prediction and of verified work: the dashed baseline line, the
  verified fill (tide at 20 % alpha), scale fills and Gantt bars.
- **Ink** draws what was observed: the observed-design step line is solid ink.
- **Amendment kinds** have fixed colours, used for marks, chips and log bullets and nowhere else:
  discovered rust, corrected ochre, requested teal, emergent violet, defect slate, external olive.
- **Dark mode** (`prefers-color-scheme: dark`) swaps to the `dark-*` values; kind colours lighten, and
  text on a kind fill becomes near-black (`#0b1218`) so it keeps 4.5:1.
- Contrast: body and table text ≥ 4.5:1 on paper and ground in both themes; checked with the Impeccable
  detector.

## Typography

- **Display and headings:** the serif stack (Sitka on Windows, Iowan Old Style on macOS, Palatino or
  Georgia elsewhere). Display only for the plan name in the band; headline for panel headings. The display
  size steps — 2 rem, 2.5 rem from a 48 rem window, 3 rem from 60 rem — rather than a `clamp()`, which the
  design detector reads as 16 px.
- **Body:** the platform UI sans at 16 px, tabular numerals everywhere.
- **Labels and numerals:** the condensed stack (Bahnschrift, DIN Alternate, Roboto Condensed). Uppercase
  labels at 0.72 rem with 0.07 em tracking; KPI values at 1.35 rem bold. Tracking is for uppercase labels only:
  the band's crumb line, in mixed case, has none.
- **Code:** `Cascadia Mono, Consolas, SF Mono, ui-monospace` only for paths, commands and commits.
- Floors: no functional text under 11 px; chart ticks 12.5 px in the 650-unit viewBox.

## Layout

- Container 72 rem, side gutter `clamp(16px, 4vw, 40px)`; 16 px at phone width, no sideways page scroll.
- **Plan page tabs, in this order:** Overview · Analysis · Performance · Work breakdown · Items ·
  Amendments · Log. Item and amendment tabs carry their count.
- **Overview:** a one-line description in the headline serif, a three-sentence plain-words story, the
  signature chart, then "At a glance" as a definition list.
- **Density — the almanac rhythm:** tables and the KPI register draw a stronger rule (`rule-strong`) under
  every fifth row, the way a tide table groups its days.
- Charts sit in a figure that scrolls sideways on its own below 540 px; the page itself never does.
- Below 760 px: KPI rows stack (name and value, then the scale, then the meaning); the Gantt label moves
  above its track and the hour scale shows every other hour.

## Elevation & Depth

Flat. Panels separate by the paper-on-ground tone step and a 1 px rule. No shadows, no blur, no glass.

## Shapes

Square panels and tables. Status tags and the `measured` tag have a 2 px corner. Amendment marks are
pills (`A3`) in tables and lists, and numbered circles (`3`) inside charts.

## Components

- **Time axis (every dated chart).** Records are dated by day, so each day is a band of the axis and a day's
  records sit at its centre; same-day marks sit side by side, centred on their day, never past the plot's edge.
  The first and last day are labelled under their bands.
- **Signature chart — predicted against observed.** X: time across the plan's life. Y: items of design
  (0 to the observed total with room above for the marks, rounded up). The predicted line is `tide`, dashed: thin and faded while the plan
  is a draft, full once baselined. The observed line is ink, solid, and steps up by one at each
  amendment that counts in the rate (discovered, corrected). Every amendment gets a kind-coloured
  numbered circle above that line; marks found the same day sit side by side. The predicted line is drawn
  over the observed one, so it shows where they are equal. The verified area steps up on the day items pass.
  The planning-and-review span is shaded `track`. Labels give the baseline and observed totals, inside the plot.
- **Discovery map:** rows are the fifteen consideration layers by canonical name; each amendment is a
  numbered kind circle placed at its time.
- **Variation (bubble):** x = when found, y = times the item changed after the baseline, size = items the
  change touched, colour = kind.
- **Rate across the store:** each finished plan in closing order, the 75–90 % band shaded tide, reference
  lines at 75 and 90, this plan's point in the discovered colour.
- **KPI register:** a four-column table — measure, value, against target, what it means — never a grid of
  same-size number tiles. The scale is a track with a tide fill and ink ticks for floor and target.
- **Gantt:** an HTML grid, not SVG: label · track · duration. Groups (W1…) as bold header rows, leaves as
  bars in tide, the planning row in muted grey, amendment pills at the time they were found.
- **Versions:** a time-ordered list — time · revision · what changed · commit; the baseline row shaded tide,
  amendment rows' revision label in its kind colour.
- **Folds:** `<details>` with a link-coloured summary; "Show the numbers" under every chart.
- **Focus:** a 2 px `focus` outline with a 2 px offset on every control; selection colour light tide.

## Do's and Don'ts

- Do keep one look in both forms: a repository HTML file and a Claude artifact use these tokens and
  sections.
- Do publish the page as it is: a Claude artifact must show the generated file unchanged, its
  Content-Security-Policy meta included. Publish it where the host serves it as it is — in Claude's artifact
  tool, as a supporting file of the artifact (`files`), never as its main page, which the host wraps in a
  document of its own and so moves the policy out of `<head>`, where browsers ignore it. A host that cannot
  serve it unchanged gets the file to download instead — never a copy without the policy.
- Do say "not recorded" for a missing measure, and tag measured against estimated.
- Don't load anything from the network, embed a font, or add a chart library.
- Don't use kind colours for anything but amendment kinds.
- Don't add eyebrow labels over headings, hero metric tiles, gradient text, shadows or decorative icons.
- Don't add world ornament (paper texture, ship motifs, nautical icons): the almanac lives in the
  palette, the serif, the five-row rhythm and the predicted-against-observed chart only.
