---
id: T-005
title: Marcaje for songs — text-mode editing
sprint: 2026-10-05
urgent: false
status: done
owner: marcaje
rolled: 0
order: 3
created: 2026-10-04
---
## Goal
Chat 21/05 BCEV: «in marcaje adauga editare ca si text». The Bible side has text import (a64a2740, 5654dfbb); SongBookmarksPanel has only export. Edit the song Marcaje list as text (paste/edit titles, one per line), in the same Markdown format as the Marcaje standard task.

## Notes
- 2026-10-05: 2026-10-05 done, waiting for review. Stacked on T-010 (PR #106 targets feat/marcaje-standard-markdown; it retargets to main once #104 merges).
branch: feat/marcaje-songs-text-mode
pr: #106 https://github.com/radio-crestin/church-hub/pull/106
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4c93d6c23754dae4d729a7fe2d05221560e51795/pr-demos-feat-marcaje-songs-text-mode/t005-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4c93d6c23754dae4d729a7fe2d05221560e51795/pr-demos-feat-marcaje-songs-text-mode/t005-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-106/church-hub-macos-arm64-pr-106-0657dc3.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-106/church-hub-windows-x64-pr-106-0657dc3.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-106/church-hub-linux-x64-pr-106-0657dc3.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a80d63c2ef959de28/.review-build/T-005/church-hub-T-005.app

What changed:
- "Edit as text" in the song Marcaje header, also shown on an empty list. It opens the list as T-010 Markdown, one line per item: "## Title {#song-12}" or a plain title / "- title", and "> note". An exported .md can be loaded too. Save makes the list exactly that text, in order.
- All or nothing: an unknown song blocks the save, and its line number is shown.
- Kept songs keep their row and their "sung" mark.
- Titles match ignoring case, diacritics and punctuation, then alternate titles.
- The full export's lyrics are skipped. To make that safe, the export now gives every slide a "### label-or-number" heading, so a title typed after a blank line is never dropped.
- API: GET/PUT /api/song-bookmarks/text (songs.view), in OpenAPI. i18n en/ro.

How to test: song page → Marcaje → Edit as text, reorder or add titles and a "> note", Save. Paste titles into an empty Marcaje. Load an exported .md: the same list comes back.

Tests: server bun test (475 pass), vitest (1406 pass), e2e song-bookmarks-text (4 tests), plus the Marcaje and bookmark regressions and panel-header-overflow (now counts the new action). CI run: https://github.com/radio-crestin/church-hub/actions/runs/37238877873

Not verified: phone layout. The Marcaje panel isn't shown below desktop width (existing layout), so the modal was only seen at desktop size; its classes are responsive (w-[calc(100%-2rem)], max-h 90vh scroll). No fuzzy title matching.
Commits: 93b8979a, f3151d29, ea92014c (merge T-010), 809cb856, 0657dc3e.
- 2026-10-05: 2026-10-05 rebased on main after #104 merged (5a4341c7); PR #106 now targets main. Commits: 62697ed4, 5c1a6e08, 490da716, 3b040dbf, 83c82b96 (Codex Romanian).
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-106/church-hub-macos-arm64-pr-106-83c82b9.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-106/church-hub-windows-x64-pr-106-83c82b9.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-106/church-hub-linux-x64-pr-106-83c82b9.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a80d63c2ef959de28/.review-build/T-005/church-hub-T-005.app (rebuilt at 83c82b96)
Local after rebase: server 487 pass; e2e song-bookmarks-text, song-bookmarks-markdown, panel-header-overflow, bookmark-row-actions, bookmarks-to-schedule, bible-bookmarks: 24 passed.
- 2026-10-05: Closed by the user. Song Marcaje editable as text in the T-010 Markdown format; Romanian via Codex. PR #106 merged.
