---
id: T-008
title: Export a song as PDF / Word for printing
sprint: 2026-10-05
urgent: false
status: done
owner: song-export
rolled: 0
order: 6
created: 2026-10-04
---
## Goal
Chat 05/07 BCEV: «(optional) ar fi util sa putem face export la cantare ca si PDF (util pentru atunci cand trebuie sa o printam)»; Bogdan: «Sau word :))». song-export only has PPTX and OpenSong. Add PDF (and DOCX) export from the song actions menu.

## Notes
- 2026-10-05: branch: feat/song-export-pdf-docx
pr: #98 https://github.com/radio-crestin/church-hub/pull/98
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4d035bd5e2dfc33d186156c0f1d30326b01945f8/pr-demos-feat-song-export-pdf-docx/t008-song-print-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4d035bd5e2dfc33d186156c0f1d30326b01945f8/pr-demos-feat-song-export-pdf-docx/t008-song-print-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-98/church-hub-macos-arm64-pr-98-f4e503b.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-98/church-hub-windows-x64-pr-98-f4e503b.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-98/church-hub-linux-x64-pr-98-f4e503b.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a09e3d202daf1e150/.review-build/T-008/church-hub-T-008.app
Done: song menu gets "Export as PDF" / "Export as Word" (A4: title, details, each label + lyrics; pdfmake + docx, pure JS, lazy). Test: CI=1 TEST_PORT=3108 bunx playwright test song-print-export page-actions-menu --workers=1 --retries=2; vitest src/features/song-export. Not verified: Tauri save dialog on Win/Linux, opening the .docx in Word. Sections print once in song order (chorus not repeated).
- 2026-10-05: Closed by the user. Song actions menu exports PDF and Word (A4: title, details, each section once in order); PR #98 merged.
