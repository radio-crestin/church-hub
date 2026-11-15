---
id: T-135
title: "e2e: a song-sources notification toast left on the test DB covers the program panel in bookmark-drag-to-program"
kind: task
level: normal
order: -21
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-07T00:00:00.000Z
updatedAt: 2026-10-07T00:00:00.000Z
---

## Goal
Found by the T-124 teammate (2026-10-07), full suite: bookmark-drag-to-program.spec.ts:83 fails because a "Cântări de aprobat" notification (pop-up toast), created by an earlier song-sources test on the shared test DB, covers the program panel the test drops onto. Passes alone (6/6) and on main. Fix the isolation at the root: the song-sources specs must clear the notifications they create (and anything that pops them up), and/or tests that drag onto panels shouldn't depend on toast state. Verify by running song-sources then bookmark-drag-to-program on the same data.

## Notes

- 2026-10-07: Video: [T-135.mp4](../tasks_videos/T-135.mp4)
2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/174 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-135/church-hub-T-135.app. Root cause: deleting a song source never refreshed the "songs to approve" notification, so it stayed (and kept popping up) across runs, since the test DB persists. Fix in deleteLinkSource. New e2e song-source-delete-pending (fails before the fix, passes after). song-sources.spec now clears its notifications. Full suite: 828 passed, 1 flaky (bookmark-drag:83, with no toast: the drop doesn't register, a separate timing issue).
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Deleting a song source now refreshes the "Cântări de aprobat" notification (app bug); song-sources.spec clears its notifications; new song-source-delete-pending spec. Merged PR #174.
