---
id: T-006
title: Song edit history — who edited and when
sprint: 2026-10-05
urgent: false
status: done
owner: song-history
rolled: 0
order: 5
created: 2026-10-04
---
## Goal
Chat 07/06 Bogdan: «istoric al cântării: cine a edit, când, etc». No per-song history exists (only device ids in sync types). Record each song change (user, time, what changed) and show it on the song, ideally with restore.

## Notes
- 2026-10-05: branch: feat/song-edit-history
pr: #102 https://github.com/radio-crestin/church-hub/pull/102
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@ddcd161cab43b0e3272721da181c3c8efe7bb56a/pr-demos-feat-song-edit-history/T-006-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@ddcd161cab43b0e3272721da181c3c8efe7bb56a/pr-demos-feat-song-edit-history/T-006-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-102/church-hub-macos-arm64-pr-102-601dbb7.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-102/church-hub-windows-x64-pr-102-601dbb7.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-102/church-hub-linux-x64-pr-102-601dbb7.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-ac9acc865258264d9/.review-build/T-006/church-hub-T-006.app
Done: server table song_edit_history + migration, saveSongWithHistory on POST /api/songs, GET/POST /api/songs/:id/history[...] (OpenAPI+Scalar), features/song-history (More menu > History dialog, restore), en/ro strings. Commits d6f3e5d4 c4f3fb02 601dbb7e. Test: bun test src/service/song-history; CI=1 TEST_PORT=3106 bunx playwright test e2e/song-history.spec.ts --workers=1 --retries=2. Not verified: packaged Tauri app by hand, a user with songs.view only. Not recorded: sync/batch import/discovery edits. Editor page has no history entry (hook-in kept to the song page).
- 2026-10-05: Closed by the user. Song page More → History: who/when/before-after per title or slides change, restore (undoable), 200 per song; API in OpenAPI. PR #102 merged.
