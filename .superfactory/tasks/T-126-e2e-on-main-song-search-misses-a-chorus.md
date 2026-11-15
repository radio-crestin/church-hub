---
id: T-126
title: "e2e on main: song search misses a chorus first line and a plain-apostrophe query"
kind: task
level: normal
order: -13
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T19:55:09.167Z
---

## Goal
Found by the T-120 teammate (2026-10-06) on plain origin/main 1d8a585f: song-alternate-titles.spec.ts:123 "the first line of the chorus finds it" (the song isn't in the search results) and stored-entities.spec.ts:91 "in search, typed with a plain apostrophe" both fail. Repro: check out origin/main, build the client for your port, `CI=1 TEST_PORT=<port> bunx playwright test song-alternate-titles.spec.ts stored-entities.spec.ts --workers=1 --retries=0`. Log: /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/9474d1e1-01f2-42a5-9c21-080e52e9f21a/scratchpad/T-120/v3/fail3-main.log. Find which merge broke search (or whether test data leaks in) and fix the root cause; mind the search-migration-hazards memory (FTS5 tiered-OR recall).

## Notes

- 2026-10-06: 2026-10-06 Root cause: no merge broke search. search.spec "can reorder categories" "restored" with a 2nd reorder, which renumbers N..1, so the seeded categories (all priority 1) drifted to BCEV 13 / Laudele 3 / Drumul 2 / RC 1 in a long-lived test DB. Search multiplied scores by category priority (up to x1.5), so weak BCEV lyric hits outranked the exact-phrase song and pushed it out of the top 50. Reproduced with T-120's drifted DB copy (scratchpad/T-126/db). Fix (commit e5bca3ea, branch task/T-126): priority is now a sort tiebreaker after the match score; reorder test restores each priority. New spec search-category-priority.spec.ts fails before (exact at 10, partial at 8), passes after. 38 search specs pass on drifted DB. Logs: scratchpad/T-126/{before,drifted,prio-before,after-drifted}.log
- 2026-10-06: 2026-10-06 Done. Video: [T-126.mp4](../tasks_videos/T-126.mp4). PR: https://github.com/radio-crestin/church-hub/pull/164 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-126/church-hub-T-126.app (port 4226, own data; server-only change, so the review build matches main except the ranking). Commit e5bca3ea. Checked: 38 search specs (search, search-diacritics, song-alternate-titles, stored-entities, song-category-hidden, new search-category-priority) pass on a fresh and on the drifted DB. The reorder spec now leaves fresh priorities at 1. Not checked: the full suite (comes after the user's yes). Side findings for the lead: specs leak "E2E Discovery/Notificari/Tags/Updates" categories (21 in T-120's DB), not my area; one security note in .claude/tasks-private/T-126-category-priority-sql.md.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/164
T-126 Song search: an exact line is no longer pushed out by category order
Once categories had been reordered, songs from the first category that shared only a word with the search came before, or instead of, the song with the exact line. Category order now only decides between songs that match equally well.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06 Accepted. Full suite (CI=1 TEST_PORT=3226, --workers=1 --retries=2): 781 passed, 34 skipped, 0 failed, 0 flaky (log scratchpad/T-126/full.log). PR #164 marked ready.
- 2026-10-06: Category priority now only breaks ties in song search (no score multiplier); search.spec restores the priorities it changes; new search-category-priority spec. Merged PR #164.
