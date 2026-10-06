# Field probes

The probes that real projects missed most often, counted from the public field reports #1–#18 of
`KDavidP1987/dod-skill`. A probe is listed when it was missed in 6 or more of the 18 reports. Each report counts
once per probe, however many design changes it recorded there. Two of the reports, #4 and #11, are audits that
cover several plans each.

Every plan created from dod 0.3.5 on answers each of these with an item whose check runs once on the draft,
before approval, and records what it printed as a dry-run note (layers.md › Field probes). A probe your project
already lists in `profile.md` is asked once, in your project's words. Only the owner can let a plan skip one, by
accepting the risk in writing.

Format, one line per probe, most reports first: `- <probe> · <count> reports · <issues> · <what the reports missed>`.

- 4.1 · 9 reports · #1 #4 #6 #7 #9 #10 #11 #16 #18 · Rules the plan stated loosely had to be made exact during the build: 8 design changes across the three plans in #11 and 7 in the single plan of #18.
- 6.2 · 9 reports · #1 #4 #6 #7 #9 #11 #13 #14 #16 · A dependency's limit or failure changed the design mid-build: in #16 a platform limit of one connector per user per environment replaced the approval mechanism, and #13 recorded 4 changes here.
- 7.3 · 9 reports · #3 #4 #5 #6 #8 #10 #11 #14 #16 · Interruption, cancel, retry and stale data were left for the build to find, one or two design changes per plan across nine reports.
- 12.4 · 9 reports · #2 #3 #4 #6 #7 #10 #11 #14 #16 · Checks that could not fail: in #16 two items could never fail on the seeded data, and #11 still counted 7 misses after rubric 2 made this probe gating.
- 14.4 · 9 reports · #2 #6 #7 #8 #9 #10 #11 #16 #18 · The change touched paths the plan never listed — ignored and lock files, a sibling plan's paths, a check that needed a later step's output (12 design changes across the three plans of #11, 8 of them in one).
- 4.5 · 8 reports · #1 #2 #3 #4 #9 #10 #11 #13 · An "every X" rule computed X from a list that missed real members, 5 design changes across the three plans of #4.
- 6.1 · 8 reports · #1 #2 #4 #5 #6 #10 #11 #16 · An external dependency behaved differently than assumed: 8 design changes in the plans of #4, and in #16 the platform's default runtime had been retired.
- 7.2 · 6 reports · #1 #4 #10 #11 #16 #17 · Two actors on one record: in #16 an approval race needed three rounds of test design, and #17 recorded 2 changes here.
- 12.2 · 6 reports · #1 #4 #6 #7 #10 #11 · What gets logged or measured was decided during the build, not in the plan, one design change in each of six reports.
- 13.1 · 6 reports · #1 #4 #7 #10 #11 #18 · Speed work the plan did not budget: indexes and trigger functions found by the database advisor or the migration (8 design changes across the three plans of #11), and 3 in #18.
