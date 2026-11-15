---
id: T-128
title: "Best-in-class search: one fast, typo-tolerant engine for Bible verses and song full text"
kind: task
level: normal
order: -15
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T22:13:17.969Z
---

## Goal
User's words (2026-10-06): "also the Bible search is not matching very good and fast when we search parts of a verse, or mispell a word.. make sure to re-use the same searchign also for songs full text search, we want best in class searching with very good performance, low latency, low cpu usage, very very fast".

1. Bible search must find a verse from any part of it (a fragment, words in the middle) and tolerate misspellings (typos, missing/wrong Romanian diacritics), with the best match first.
2. One shared search engine/module, reused for both Bible and song full-text search (not two engines).
3. Very low latency per keystroke, low CPU, on the full data (all Bible translations, ~26k songs), in the Bun sidecar on macOS/Windows/Linux.
Measure before/after (latency p50/p95, CPU, recall on a set of fragment + misspelling queries for both Bible and songs) and put the numbers in the PR. Ground the choice in the project's earlier findings: memories search-migration-hazards, pg-fts-parity-proven and chromadb-search-experiment (FTS5 tiered-OR recall traps, ts_rank_cd for Bible, the PR #25 semantic vs SQLite results), and the current docs of any library used. Must not regress the existing search e2e specs (incl. T-126's category tie-break).

## Notes

- 2026-10-06: 2026-10-06 search-2 started. Worktree env on port 3228. Reading current Bible (service/bible/search.ts: FTS5 strict AND, translation filter applied after a limit*5 candidate cut) and song (service/songs/search.ts: 3-phase FTS5 + trigram + JS re-rank) search. Next: baseline benchmark on a copy of the real DB.
- 2026-10-06: 2026-10-06 search-2: baseline measured on a copy of the real DB (2 Bible translations, 25.7k songs; 375 Bible + 300 song queries: fragment, partial last word, 1-2 typos, old/new orthography, no diacritics). Bible @1 141/375 (typo1/typo2/orthography 0/180), query p50 2.5 ms p95 6.0. Songs @1 72/300, @10 157/300, query p50 198 ms p95 400, ~152 ms CPU per keystroke. Plan: one shared engine in service/text-search (FTS5 for candidates; an in-memory vocabulary from fts5vocab for typo variants, walked as a trie; one scorer in JS that weighs coverage, phrase order and typos), used by both Bible and songs; the slow trigram phase goes. Committed so far: shared text helpers moved to text-search, vocabulary loading, findSimilarTerms (about 1 ms per word on 64k song words). Next: term groups, FTS query tiers, scorer, then wire Bible and songs and re-measure.
- 2026-10-07: 2026-10-07 search-2: both searches now run on one shared engine (service/text-search). Measured on a copy of the real DB with the same 675 queries. Bible: best-first recall 141 → 366 of 375 (typos 0 → 126/130, old orthography 0 → 50/50); query p50 2.5 → 5.0 ms, p95 6.0 → 8.8 ms; keystroke p95 8.8 → 8.6 ms. Songs: best-first 72 → 235 of 300, top-10 157 → 281; query p50 198 → 15.5 ms, p95 400 → 54 ms; keystroke p50 156 → 20 ms, p95 472 → 50 ms; CPU per keystroke 152 → 22 ms. The trigram index is dropped by a migration. AI song search now runs each AI term separately. Search vocabularies load right after the server is ready, not during boot. Security finding fixed in 7a5460e8 (write-up in tasks-private). New e2e spec search-typo-tolerance.spec.ts; the 50 search/Bible e2e tests pass. Full suite running now; then video, PR and review build.
- 2026-10-07: Video: [T-128.mp4](../tasks_videos/T-128.mp4)
- 2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/169
- 2026-10-07: app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-128/church-hub-T-128.app
- 2026-10-07: Done (search-2).

What changed: one shared engine in app/apps/server/src/service/text-search, used by Bible search (bible/text-search/searchVersesByText.ts) and song search (songs/song-search/*).
- FTS5 finds the candidates. Each index's word list is loaded into memory and searched for typos as a trie (findSimilarTerms, about 1 ms per word).
- Candidates are scored in JS (scoreTextMatch): coverage weighted by rarity, the longest in-order phrase, typos. Exact matches rank before typo matches.
- Song title matches are looked up first. The trigram index is dropped by a migration (drop_songs_trigram_index).
- The Bible translation filter now runs inside the index lookup. Bible import and delete reset the search state.
- AI song search runs each AI term separately.
- Highlights are HTML-escaped (security fix, see tasks-private).
- The search vocabularies load right after the server is ready.

Numbers (same 675 queries, copy of the real DB): Bible found first 141 → 366/375, keystroke p95 8.8 → 9.9 ms. Songs found first 72 → 236/300, keystroke p50 156 → 26 ms, p95 472 → 59 ms, CPU per keystroke 152 → 27 ms.

Commits: b1ef2d44 7c8d392b efc865e4 21ebf0a4 811485ea 7a5460e8 a15d128d 9d31828c 004679f3 143108e7 b3f9549e 44d742d0.

Checks:
- The 57 search, Bible and file-drop e2e tests pass on the final code.
- The full suite on an earlier commit: 811 passed, 1 failed (the pptx import). That failure was a real gap, fixed by looking up title matches first; the full suite is running again on the final code.

What I couldn't check:
- The compiled sidecar smoke test (pure TypeScript change, no native modules).
- The first-start vocabulary load on Windows and Linux. On macOS it takes about 0.7 s, up to 2.6 s cold, on a 26k-song library, right after the server is ready.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/169
T-128 Best-in-class search: one fast, typo-tolerant engine for Bible verses and song full text
Bible and song search now find a verse or a song from any part of it, even with typos, without diacritics or in the old spelling, best match first. Song search is about 6× faster per letter typed.
- 2026-10-07: Full suite on the final code (44d742d0): 808 passed, 34 skipped, 1 failed. The failure is song-sources.spec.ts:188 ("a shared link becomes a source…"): a strict-mode violation because the source URL is listed twice after its own retry left a duplicate source. It has nothing to do with search; it passed in the first full run and passes alone (7/7). The pptx import failure from the first run is fixed (title matches first). Review build: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-128/church-hub-T-128.app
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Finished. Rebased onto main (with T-131 #170). Full suite on the rebased branch: 819 passed, 0 failed (13.7 min). PR #169 is marked ready and mergeable; no checks run on PRs. Review build rebuilt.
- 2026-10-07: One shared typo-tolerant search engine (service/text-search) for Bible and songs: Bible right-verse-first 141→366/375, songs 72→236/300 with keystroke p50 156→26 ms and CPU 152→27 ms; trigram index dropped; highlights escaped. Merged PR #169.
