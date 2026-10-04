---
id: T-036
title: /api/songs without a limit returns every song (10MB)
sprint: 2026-09-28
urgent: false
status: done
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
- Commits (rebased on origin/main 0247de61): cd07edcb (server + OpenAPI), b2a365db (client card + tests), 0aac8c38 (song-import-export spec read the bare list; now uses batch songIds).
- Not done / not verified: no cap on an explicit `limit` (A-Z rail asks 100000 on purpose); external API clients expecting an array from bare /api/songs would break (none in repo). Uncategorized list shows first 200 A-Z if more exist (count and Delete all cover all).
- 2026-10-04: User review 2026-10-04: wants the full PR link in the review message; re-record videos with red boxes/arrows (T-053 helper) before asking again.
- 2026-10-04: Re-recorded both videos with red highlights (before on origin/main da693918, after on the branch); branch rebased on origin/main; PR body and links updated (release tag ...-v2).
- 2026-10-04: Re-recorded with voice-over (captions in full words) and red highlights; rebased on origin/main 0247de61; PR body and links updated (tag ...-v3).
- 2026-10-04: After rebase on 0247de61 (0aac8c38): e2e songs-api-pagination, song-category-hidden, api-comprehensive, file-drop-import, song-import-export, songs, settings, songs-alphabet-scroll, song-key: 106 passed, 1 skipped, 0 failed (--workers=1 --retries=2).
- 2026-10-04: /api/songs always pages (default 50) + uncategorized filter; Settings › Songs loads 32 KB instead of 12 MB. PR #77 (not merged yet; may need a rebase against #80).

## PR
- branch: fix/songs-api-default-page-size
- PR: #77 https://github.com/radio-crestin/church-hub/pull/77
- before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-songs-api-default-page-size-v3/T-036-Before-api-songs-without-a-limit.mp4
- after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-songs-api-default-page-size-v3/T-036-After-api-songs-without-a-limit.mp4
