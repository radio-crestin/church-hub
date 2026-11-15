---
id: T-131
title: 'e2e: song-sources.spec "a shared link becomes a source" is flaky (manifest URL matches 2 elements)'
kind: task
level: normal
order: 17
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T21:57:21.957Z
---

## Goal
Found by the T-122 teammate (2026-10-06), full suite serial: song-sources.spec.ts:205 first timed out at :232, then on retry getByText(<manifest url>) matched 2 elements (the source row and the song-source-publication block): strict-mode violation. Log: /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/9474d1e1-01f2-42a5-9c21-080e52e9f21a/scratchpad/T-122-full.log. Also seen by T-127's run: search-snippets-text.spec leaves songs behind when a run dies before its cleanup (move cleanup to afterEach/afterAll). Fix both at the root.

## Notes

- 2026-10-07: 2026-10-07 Done. Video: [T-131.mp4](../tasks_videos/T-131.mp4). PR: https://github.com/radio-crestin/church-hub/pull/170 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-131/church-hub-T-131.app (only a data-testid changes in the app). Commit edfead49 on task/T-131 (off 520b2b44).
Root causes: (1) song-sources waited for the share URL anywhere on the page, and the publication row from the previous test shows the same URL. The wait passed at once, the test left the page before the app asked for the new source to be checked (0 songs in discovery = the 30 s timeout), or it matched both rows (strict mode). It now waits for the link's own row (data-testid song-source-link). (2) search-snippets-text already cleaned up in a finally. The leftovers came from other specs in a run that crashed, which no cleanup can prevent. Its searched timestamp also finds nearby numbers, so it now asserts on its own card and program only.
Checked: main 4 of 5 repeats failed; now 65 passed over 8 repeats of both specs. With a leftover song carrying a nearby number, main's search-snippets-text fails with the T-127 error and the new one passes. Not checked: the full suite (comes after the user's yes).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/170
T-131 Two flaky tests fixed (song sources, search result text)
The song-sources test now waits for the source it just added, not for a look-alike row. The search-text test checks only its own song, so songs left behind by an interrupted run no longer fail it. No change in the app itself.
- 2026-10-07: From the T-130 full run (2026-10-07): search-snippets-text.spec.ts:43 fails on all 3 tries because song-sources.spec.ts's shared-link test leaves its imported songs ("Shared Song A/B <timestamp>") in the test DB; they match the timestamp search, giving 3 <mark>s instead of 1. Repro: run song-sources.spec.ts then search-snippets-text.spec.ts on the same data. Log: /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/9474d1e1-01f2-42a5-9c21-080e52e9f21a/scratchpad/T-130-full.log. Part of this task: the shared-link test must delete what it imports, and the snippet spec should scope to its own song.
- 2026-10-07: 2026-10-07 Imported-songs leak covered (commit 3bb72b78, pushed to #170, new video). Root cause, from T-130's log and DB: the shared-link attempt failed at the URL wait before keeping linkSourceId, so afterAll never deleted the link source. A later spec's "import all" in Song discovery imported its songs into a new category (category 92 in T-130's DB). With the old cleanup, every failed attempt left its link source: 8 in my test DB. The afterAll now deletes its link sources by name, stops song checks and waits until idle, then deletes the categories and turns auto-update back on. The search-based delete now matches exact titles only (it used to delete every hit). Checked: with a failure simulated right after "Add source", the new cleanup leaves 0 link sources, 0 shared categories and 0 shared songs. song-sources then search-snippets-text, 5 repeats on the same data: 41 passed and nothing left. Full suite still to run after the user's yes.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/170
T-131 Two flaky tests fixed (song sources, search result text)
The song-sources test now waits for the source it just added, and cleans up everything it adds even when it fails. The search-text test checks only its own song. No change in the app itself.
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: 2026-10-07 Accepted. Rebased onto 824c6160. Full suite on a freshly seeded test DB (CI=1 TEST_PORT=3226, --workers=1 --retries=2): 813 passed, 34 skipped, 0 failed, 0 flaky. Afterwards the test DB had 0 link sources, 0 Shared songs, 0 E2E Shared categories, and the built-in priorities were at 1. PR #170 marked ready.
- 2026-10-07: song-sources shared-link test waits for its own row and cleans up its link sources/songs even on failure; search-snippets-text checks only its own card. Test-only. Merged PR #170.
