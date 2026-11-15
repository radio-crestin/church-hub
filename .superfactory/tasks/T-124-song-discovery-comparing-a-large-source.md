---
id: T-124
title: "Song discovery: comparing a large source is slow (~10 s per 150 songs)"
kind: task
level: normal
order: -19
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T23:12:07.206Z
---

## Goal
Found by the T-120 teammate (2026-10-06): in Song discovery, comparing a source with a large library takes about 10 seconds per 150 songs, which predates T-120. Find the root cause (e.g. per-song queries or diffs instead of one batch) and make the comparison fast for sources with tens of thousands of songs, e.g. Resurse Creștine's 24,451. Measure before/after.

## Notes

- 2026-10-06: Lead (2026-10-06): T-120 measured a full check of all four sources at ~3 min, Laudele Domnului ~75 s, spent in the library similarity search. That search is being rebuilt in T-128 (one fast engine for Bible + songs), so T-124 goes to T-128's owner (search-2) right after T-128, to build on the new engine.
- 2026-10-07: 2026-10-07 search-2: root cause found and fixed on branch task/T-124 (based on task/T-128), commit f3338213 (to be rebased once T-128 merges).
- Cause: every candidate cost two full library searches, a title search (the whole song search pipeline) and a 60-term OR FTS query over the lyrics ranked by BM25, plus a query for the hidden songs.
- Fix: song-versions/ builds an in-memory index of the library once (word ids, title and lyrics postings; 25.7k songs in 1.4 s, then kept until the songs change). Each candidate walks only the songs sharing a distinctive title word, or holding at least 70% of its lyric words, and scores them with the same formula as before. Tags and entities in lyrics no longer count as words.
- Measured on a copy of the real DB: 300 library songs under a changed title, half with every other line dropped. main 354 ms per song (106 s), task/T-128 alone 173 ms, T-124 5.9 ms per song including the index build, 0.9 ms per song at 1,500 songs. 24,451 songs: about 25 s instead of about 2.4 h.
- Same results: 295 of 300 suggestion lists identical; 4 differ only in the order of tied songs. One borderline 0.55 match drops to just under the cut-off because HTML tags no longer count as shared words.
- e2e: song-discovery, song-discovery-lyrics-text, song-versions and song-sources pass (25).
Next: e2e spec, video, PR after T-128 merges.
- 2026-10-07: Video: [T-124.mp4](../tasks_videos/T-124.mp4)
- 2026-10-07: Done (search-2), on main after T-128.
Commits: 47c89862 (library version index) and e4c2284e (e2e).
PR: https://github.com/radio-crestin/church-hub/pull/172
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-124/church-hub-T-124.app

What changed: Song discovery, the song editor's "possible versions" and the song-sources update check now compare songs through an in-memory index of the library. It is built once (1.4 s for 25.7k songs) and dropped when songs change. Each song is compared only with the library songs that share a distinctive title word, or hold at least 70% of its lyric words, using the same scoring formula as before. Measured: 354 ms per song on main → about 1 ms (24,451 songs: about 2 h 24 min → about 25 s), with the same suggestions in 295 of 300 cases (4 differ only in the order of ties, 1 borderline match lost to the `br`-tag fix).

What I couldn't check: a real download of the Resurse Creștine source. The numbers come from library songs under changed titles, compared on a copy of the real DB. The full suite is running.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/172
T-124 Song discovery: comparing a large source is slow (~10 s per 150 songs)
Comparing a song source with your library is now hundreds of times faster: Resurse Creștine (24,451 songs) takes about 25 seconds instead of over two hours, with the same "possible versions" as before.
- 2026-10-07: Update (commit 14309786, rebased on main 9dcf679c):
- The version index now follows song saves, imports and deletes song by song, and is built right after start-up (1.2 s, the same deferred warmup as the search vocabularies). It is no longer rebuilt inside a request after every song change; only a full search-index rebuild drops it.
- Measured again: 4.8 ms per song for 300 including the build; same suggestions (295/300 identical, as before).

Full suite (before this fix): 820 passed, 3 flaky. bookmark-drag-to-program.spec.ts:83 failed. Its screenshot shows a "Cântări de aprobat" notification toast, left by an earlier song-sources test on the shared test DB, covering the program panel it drops onto. It passes alone on this branch (6/6) and on main. This is an isolation gap between those specs, not this change; it is worth its own task.

The specs near the change pass: song-discovery, song-discovery-library-index, song-versions, song-sources (26). PR #172 updated; review build rebuilt.
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Finished. Rebased onto main (080ec6d3, with T-134). Full suite: 830 passed, 0 failed, 1 flaky (bookmark-drag-to-program, the notification toast left on the test DB; T-135 handles it). PR #172 is marked ready and mergeable; review build rebuilt. Benchmark DB copies and test results deleted; cargo clean run in the worktree.
- 2026-10-07: Song discovery version matching uses an in-memory word index of the library (built once after start, updated per song): ~354 ms → ~1 ms per song, same suggestions. Merged PR #172.
