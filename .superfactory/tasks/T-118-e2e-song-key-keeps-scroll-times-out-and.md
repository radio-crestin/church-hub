---
id: T-118
title: "e2e: song-key-keeps-scroll times out and leaves its songs behind, breaking song-picker-filters"
kind: task
level: normal
order: -9
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T14:27:50.014Z
---

## Goal
Found by the T-110 teammate (2026-10-06), full suite on main: `e2e/song-key-keeps-scroll.spec.ts` hits the 30 s test timeout (on main too). Its cleanup then fails, so its ~50 "E2E Scroll" songs stay in the test DB, and `e2e/song-picker-filters.spec.ts` ("search API narrows results by tag") then gets 50 results instead of 3.
Repro: `cd app/apps/client && CI=1 TEST_PORT=<port> bunx playwright test e2e/song-key-keeps-scroll.spec.ts --workers=1 --retries=0`.
Find why it times out (test or app regression), fix the root cause, and make the cleanup robust so one failing spec can't leak data into others.

## Notes

- 2026-10-06: 2026-10-06: Root cause found (test, not app). /song-key lists presented songs by last_presented_at DESC NULLS LAST, 30 per page. The spec sets only presentationCount, so its songs have no lastPresentedAt and sort after every song the earlier specs really presented. Row "25" is then off page 1, and scrollIntoViewIfNeeded waits for a row that never loads, until the 30 s timeout. Cleanup sits in `finally` and uses `request`, which is already torn down by then, so the 40 songs leak. Repro: mark 40 songs presented in the test DB, then run the spec: it times out, 40 "E2E Scroll" songs left. BEFORE: scratchpad/before/. Fix: scroll the list until the row loads (as a user does), and move the cleanup to afterEach.
- 2026-10-06: 2026-10-06: Done. Video: [T-118.mp4](../tasks_videos/T-118.mp4). PR: https://github.com/radio-crestin/church-hub/pull/157. Commit 2b4a6fec, test-only (app/apps/client/e2e/song-key-keeps-scroll.spec.ts): it scrolls the list until its row loads, and the cleanup moved to afterEach. Checked on a DB with 40 recently presented songs: before, the spec timed out and leaked 40 songs; after, song-key-keeps-scroll, song-key and song-picker-filters pass (8/8), and a copy forced to time out leaves 0 songs. No app change, so no review build. Not checked yet: the full suite (comes after the yes). Side observation, not fixed: song-picker-filters searches by a bare Date.now() number, so the fuzzy search also matches other numeric titles; it will break again if any spec leaks such songs.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/157
T-118 e2e: song-key-keeps-scroll times out and leaves its songs behind
The Game cântări test now scrolls down to find its song when earlier tests have filled the list, and always deletes its songs, even when it fails. The app itself was fine.
- 2026-10-06: 2026-10-06: Side note fixed as the lead asked, commit c9fb940d. song-picker-filters now searches for a random 12-letter word instead of Date.now(). Checked with 50 number-titled "E2E Scroll" songs leaked into the test DB: the old spec got 50 results instead of 3, and the new one passes (2/2). PR #157 is updated with the new video (it adds the picker scenes). Scratch files are in scratchpad/T-118/.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/157
T-118 e2e: song-key-keeps-scroll times out and leaves its songs behind
The Game cântări test now scrolls down to find its song and always deletes its songs, even when it fails. The song picker test searches for a random word, so songs left over by other tests can't confuse it. The app itself was fine.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Accepted. Full suite (CI=1 TEST_PORT=3218, --workers=1 --retries=2): 757 passed, 34 skipped, 0 failed, 0 flaky, 13.5 min; song-key-keeps-scroll and song-picker-filters pass in it. Log: scratchpad/T-118/full-suite.log. PR #157 marked ready: mergeable with no conflicts and no checks. GitHub shows it BLOCKED only because main's branch protection needs `--admin`.
- 2026-10-06: song-key-keeps-scroll scrolls until its row loads, cleanup in afterEach; song-picker-filters searches a random word. Test-only. Merged PR #157.
