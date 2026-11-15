---
id: T-110
title: "Bible takeover: the second slide shows the first slide's content in a different format"
kind: task
level: normal
order: -3
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T13:00:14.348Z
---

## Goal
User's words (2026-10-06, testing the dev app on latest main): "when i switch through the e2e bible takeover on the second slide, the text formatting is different, but on the second slide i can see the content from the first slide".

So: stepping through a Bible takeover (the e2e Bible takeover scenario), on the second slide the formatting changes and the content still shown is the first slide's. Expected: the second slide shows its own content, in the same formatting as the first. Find the root cause (rendering goes through usePresentationContent), fix it, and cover it with an e2e spec.

## Notes

- 2026-10-06: Repro (worktree port 3210, e2e data). Formatting: REPRODUCED. A song's last slide (with "Amin") renders with the `song_last_slide` layout, its first slide (with a gama) with `song_first_slide`. A screen that never saved those two gets the factory design for them, not its own saved `song` design. When the dev server's Main screen had a customized `song` (Times New Roman, full screen; seen via GET at 12:20), slide 1 was in Times and slide 2 in Fira Sans bold. BEFORE: scratchpad/before/grid2.png. Since then the dev server's configs read as factory Fira Sans everywhere, so something reset them. "First slide's content on the second slide": NOT reproduced (frame-by-frame captures of the change are clean; screens, preview and stage all show slide 2). Asked the lead where the user saw it. Fix planned (server): a missing song_first_slide / song_last_slide inherits the screen's saved `song` config.
- 2026-10-06: Video: [T-110.mp4](../tasks_videos/T-110.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/152
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-110/church-hub-T-110.app (its own port 4210 and data; fresh data creates screens that already have every layout, so the bug can't be seen there without an old screen)
Done. Cause: a screen that never saved the song first-slide or last-slide layout got the factory design for them, not its own song design, so the "Amin" slide changed font, size and position. Fix (server, `getMissingContentConfig.ts` + `screens.ts`): those missing layouts now inherit the screen's saved `song` config (first slide without amen, last slide without songKey). Commit 4fe3f33a. New spec `song-slide-layouts-follow-song-design.spec.ts` (fails on main, passes). Related specs pass: 44 across screen-editor, screen-rendering, default-slide-design, schedule-panel-presenting, preview-matches-projection, screen-duplicate. Not checked: "the first slide's content on the second slide", not reproduced; the lead asked the user. `bun run lint` reports 17 errors already on main, in files this task doesn't touch; the changed files are clean.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/152
T-110 Bible takeover: the second slide shows the first slide's content in a different format
The last slide of a song (the one with "Amin") now keeps the same text design as the other slides, on screens set up before that slide had its own layout. The "first slide's text on the second slide" part did not happen in my tests: a screenshot would help.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved). The "first slide's content on slide 2" part no longer happens; dropped.
- 2026-10-06: Accepted. The user says the "first slide's content on slide 2" no longer happens, so that part is dropped (also from the PR). Full suite (CI=1 TEST_PORT=3210, --workers=1 --retries=2): 755 passed, 34 skipped, 2 failed, both unrelated. `song-key-keeps-scroll.spec.ts` times out at 30 s on main too (checked with main's screens.ts). Its cleanup then fails, leaving its "E2E Scroll" songs behind, which makes `song-picker-filters.spec.ts` "search API narrows results by tag" get 50 results instead of 3. PR #152 marked ready: no conflicts, no checks on PRs.
- 2026-10-06: Song first/last slide layouts now follow the screen's own saved song design when the screen never saved them. Merged PR #152.
