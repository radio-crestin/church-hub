---
id: T-036
title: /api/songs without a limit returns every song (10MB)
sprint: 2026-09-28
urgent: true
status: doing
owner: songs-search
rolled: 0
order: -9
created: 2026-10-04
---
## Goal
Chat 21/05 BCEV: «api-ul http://localhost:3000/api/songs intoarce 10mb de date». With limit it pages; without it the legacy branch returns getAllSongs() (index.ts ~5195-5270, songs.ts 109-120). Make it always paginate with a default page size; update callers and OpenAPI.

## Notes
- 2026-10-04: Done, PR #77. Changed: GET /api/songs always pages (default 50, `DEFAULT_SONGS_PAGE_SIZE`); legacy getAllSongs removed server+client; new `uncategorizedOnly` filter; Settings › Songs "Uncategorized" card uses `useUncategorizedSongs` (count = `total`); OpenAPI documents paged reply + tagIds/hasKeyLine/sortBy/uncategorizedOnly. Callers checked: only the uncategorized card, file-drop e2e cleanup and server api.test used the bare list; all others send `limit`.
- Measured (test DB, 26k songs): settings page songs traffic 12.1 MB → 32 KB; bare /api/songs 12.0 MB → 23 KB.
- Test: `CI=1 TEST_PORT=3136 bunx playwright test e2e/songs-api-pagination.spec.ts --workers=1 --retries=2`; also passed song-category-hidden, api-comprehensive, file-drop-import, songs, settings, songs-alphabet-scroll, song-key; server `bun test src/__tests__/api.test.ts -t "GET /api/songs"`; client songs service unit tests.
- Commits: 83a0ed50 (server + OpenAPI), 81b62770 (client card + tests), 161d1a2a (song-import-export spec read the bare list; now uses batch songIds).
- Not done / not verified: no cap on an explicit `limit` (A-Z rail asks 100000 on purpose); external API clients expecting an array from bare /api/songs would break (none in repo). Uncategorized list shows first 200 A-Z if more exist (count and Delete all cover all).

## PR
- branch: fix/songs-api-default-page-size
- PR: #77 https://github.com/radio-crestin/church-hub/pull/77
- before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-songs-api-default-page-size/T-036-Before-api-songs-without-a-limit.mp4
- after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-songs-api-default-page-size/T-036-After-api-songs-without-a-limit.mp4
