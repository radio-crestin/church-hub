---
id: T-014
title: Bible verse list sometimes stuck, can't scroll
sprint: 2026-09-28
urgent: false
status: done
owner: bible
rolled: 0
order: -4
created: 2026-10-04
---
## Goal
Chat 09/07 BCEV: «cand este afisat un verset, cateodata nu pot da scroll iar partea din stanga ramane blocata» (🟢 reaction in the group; confirm it still happens). Scroll fixes exist (2d9dc061, 9aff0b30, f56808ef; VersesList.tsx userTookOverScrollRef). Reproduce, find the root cause, fix.

## Notes
- 2026-10-04: (bible) Could NOT reproduce on current main (b3c0a20b), Chromium 1440x900, isolated server :3114. Likely already fixed: report 09/07 predates 95e17d87 "stop auto-scroll from warping the verse list during user scroll" (16/07, shipped v0.1.97 on 10/09) — same symptom: after a verse is shown, a ~3 s re-centre loop restarted on every re-render and yanked the list back while scrolling. Tried, logging every scrollTop write + scrollIntoView on the list after the first wheel: (1) search "Ioan 3:16" + Enter, wheel up 60x; (2) click a verse, wheel down at once; (3) ArrowRight, wheel up at once; (4) slow trackpad-like wheel up from Ioan 3 across the load of Ioan 1-2. Result: zero code writes fighting the user; content moves monotonically; chapter prepend keeps position. At 1000/800 px wide the whole page scrolls instead (by design), still scrollable. Existing regressions pass: bible.spec.ts -g "warp back|snap back" 5/5. Not tested: WebKit (macOS shell; webkit browser not installed). WebKit-only risk spotted (not a "stuck" symptom): scroll preservation measures prepended chapters while still loading placeholders; Chromium scroll anchoring hides it, WebKit may jump when scrolling up into a previous chapter. Waiting for the lead: close as fixed in v0.1.97, or ask the church which OS/version still shows it.
- 2026-10-04: Not reproducible on main; already fixed by 95e17d87 (shipped in v0.1.97). User confirmed close. No new code.
