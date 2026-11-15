---
id: T-132
title: "Client type check: fix the remaining ~220 tsc errors (presentation, Bible routes, song export, songs components, e2e)"
kind: task
level: normal
order: -17
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-07T00:00:00.000Z
updatedAt: 2026-10-07T00:00:00.000Z
---

## Goal
Found by the T-130 teammate (2026-10-07): after T-130 (song-import and routes/songs), `tsc --noEmit` in app/apps/client still reports ~220 errors: presentation rendering (~90, incl. usePresentationContent), routes/bible (~30, same '/bible/' typed-path pattern as T-130), song-export, songs components and e2e specs. Full list: /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/9474d1e1-01f2-42a5-9c21-080e52e9f21a/scratchpad/T-130-tsc.txt. Fix them at the root so the client type check is clean; one commit per area, real bugs found along the way noted in the PR.

## Notes

- 2026-10-07: User (2026-10-07): the removed green one-click "add to program" button stays gone; remove its leftovers in SchedulePanel.tsx (variant, candidateSong props, addPassageToSelected) and stop the hosts passing them.
- 2026-10-07: Video: [T-132.mp4](../tasks_videos/T-132.mp4)
2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/171 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-132/church-hub-T-132.app. Client tsc now 0 errors, lint clean. Full suite: 811 passed, 1 failed (search-snippets-text, already reported as leftover data from song-sources), 1 flaky. Real bugs fixed: screen share edge constraints were ignored (new e2e screen-share-position.spec.ts, fails before and passes after), duplicate prosemirror-model in bun.lock, ConfirmModal ignored isLoading, livestream ws connected to null/ws on mobile, MIDI auto-connect errors were swallowed.
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Client type check clean (~220 → 0); fixed screen-share edge constraints, duplicate prosemirror-model, delete-all confirm loading, livestream null/ws on mobile, swallowed MIDI auto-connect errors; removed dead code incl. the one-click-add leftovers. Merged PR #171.
