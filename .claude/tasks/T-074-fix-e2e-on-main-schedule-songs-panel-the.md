---
id: T-074
title: "Fix e2e on main: schedule-songs-panel \"the song editor drops the row buttons\""
sprint: 2026-10-05
urgent: false
status: done
owner: song-editor-2
rolled: 0
order: -4
created: 2026-10-05
---
## Goal
The full e2e run fails on main: app/apps/client/e2e/schedule-songs-panel.spec.ts:315 "the song editor drops the row buttons" (runs 37240988609 at 51363d8d and 37241626986). Likely since the song editor layout change T-003 (PR #99, editor panels moved to the shared workspace, Programe removed). Find whether the app or the test is wrong now; fix the root cause so main's full e2e is green again.

## Notes
- 2026-10-05: Done. The test was wrong, not the app. T-003 (PR #99) removed the Programe panel from the song editor on purpose, but the test's first half still opened /songs/<id>/edit and waited for schedule-songs-panel there, so it timed out. Fix: the test now checks only the song page rows (they keep their edit and present buttons). I also removed the showSongRowActions prop from SchedulePanel: only the editor used it, so it was dead code and nothing changes for users. How to test: CI=1 TEST_PORT=3174 bunx playwright test e2e/schedule-songs-panel.spec.ts e2e/song-editor-layout.spec.ts --workers=1 --retries=2 passes (32 tests). Commit a9cd9c4c.
branch: fix/schedule-songs-panel-e2e
pr: #110 https://github.com/radio-crestin/church-hub/pull/110
before: none (the app does not change)
after: none (the app does not change)
build: not needed, the app does not change
Not checked: the full e2e suite (I ran only these two specs); CI on the PR.
- 2026-10-05: Closed by the user. Out-of-date schedule-songs-panel test now checks the song page; unused showSongRowActions removed. PR #110 merged.

## PR
- branch:
- pr:
- video:
