---
id: T-040
title: Hidden song categories also hidden in search and pickers
sprint: 2026-09-28
urgent: true
status: doing
owner: songs-search
rolled: 0
order: -10
created: 2026-10-04
---
## Goal
Chat 04/06 Iosif: «ar fi ok ca să avem posibilitate are a ascunde o categorie de cântări în toată aplicația (eg. poate nu vor să afișeze cântările BCEV Baicoi)». is_hidden exists (33999d7e) but is applied only in songs.ts ~211; service/songs/search.ts and the program/presentation pickers ignore it. Hide everywhere.

## Notes
- 2026-10-04: Finding: search and the pickers already dropped hidden-category songs, but only in JS AFTER the SQL LIMIT (FTS 400 / title 200 / trigram 150 candidates). A big hidden category filled those slots: hide "Resurse Crestine" (23k songs) → "slava" found 2 songs although the other categories have 50+ matches (Isus 50→11, har 50→4). Program add-song picker, version linking, edit-as-text and imports all use /api/songs/search, so they were hit too.
- Fix: new `service/songs/visibleCategoryCondition.ts`, used in the WHERE of the hymn pre-phase + title/FTS/trigram candidate queries and in getSongsPaginated; JS post-filter removed.
- Test: `CI=1 TEST_PORT=3140 bunx playwright test e2e/song-category-hidden.spec.ts --workers=1 --retries=2` (new case: 450 hidden songs outranking 2 visible; fails on old search.ts, passes now). Also passed: search, search-diacritics, songs, song-alternate-titles, schedules, api-comprehensive, song-versions, schedule-management, schedule-songs-panel, song-discovery; server `bun test src/service/songs/` (91).
- Commits: 35514184 (fix), 740cdfef (e2e).
- Left on purpose (listed in PR "Out of scope"): songs already in programs/queue, bookmarks, direct song by id, export, version-group members, discovery exact-match, admin category pickers. Not verified manually on devices. PR #77 (T-036) touches the lines next to this in songs.ts; whichever merges second may need a trivial rebase.

## PR
- branch: fix/hidden-categories-search
- PR: #80 https://github.com/radio-crestin/church-hub/pull/80
- before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-hidden-categories-search/T-040-Before-hidden-category-and-search.mp4
- after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-hidden-categories-search/T-040-After-hidden-category-and-search.mp4
