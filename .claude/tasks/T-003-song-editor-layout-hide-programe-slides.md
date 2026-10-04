---
id: T-003
title: Song editor layout — hide Programe, Slides on the right, text edit in place, fixed title
sprint: 2026-10-05
urgent: false
status: done
owner: song-editor
rolled: 0
order: 0
created: 2026-10-04
---
## Goal
Chat 12/07 BCEV: «ma gandeamca atunci cand se apasa pe butonul de editare, sa avem un toggle si atunci sa comutam intre cele 2 moduri, editare text sau powerpoint»; Iosif: «ar fi bine să adăugăm un buton de edit fix când se afișează un slider pentru a actualiza ecranele pentru a face prezentare». User 04/10: when the editor is opened from the top-right corner, remove the Programe section and move Slides to the right so the centre is easier to see; "Editează ca text" switches that Slides section to text editing in place (no new modal); keep the song title fixed (sticky) while editing.

## Notes
- 2026-10-05: branch: feat/song-editor-slides-right
pr: #99 https://github.com/radio-crestin/church-hub/pull/99
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@771d0962ea46f0bfb08db95f4d3513a05a7720b1/pr-demos-feat-song-editor-slides-right/song-editor-layout-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@771d0962ea46f0bfb08db95f4d3513a05a7720b1/pr-demos-feat-song-editor-slides-right/song-editor-layout-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-99/church-hub-macos-arm64-pr-99-4ce8d22.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-99/church-hub-windows-x64-pr-99-4ce8d22.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-99/church-hub-linux-x64-pr-99-4ce8d22.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-afdaadd7c6b105ad4/.review-build/T-003/church-hub-T-003.app
commit: 4ce8d221. Changed: editor drops Programe, rail on the right, sticky title row, Edit as text in place (SongSlidesTextEditor, modal deleted; also applies in SongEditorModal and the discovery candidate editor since they share SongSlidesSection). Test: e2e/song-editor-layout.spec.ts + song-editor-header-layout.spec.ts pass. Not verified: packaged app UI by hand; slides edited in text mode lose notes/styleOverrides on save (same as the old modal).
- 2026-10-05: User review of PR #99 (request changes): «allow resizing the layout of the slides... reuse the same layout system from the other pages.. keep the UI easy to customize and consistent». So the editor's panels (Slides rail and centre) must be resizable/draggable with the same panel layout system the song page and other pages use, not a fixed layout.
- 2026-10-05: Update after review (resizable layout): 
branch: feat/song-editor-slides-right
pr: #99 https://github.com/radio-crestin/church-hub/pull/99
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@1da8c07412862093480004dfda9da120356ca6e4/pr-demos-feat-song-editor-slides-right/song-editor-layout-after-v2.mp4 (before video unchanged)
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-99/church-hub-macos-arm64-pr-99-7fa1eb2.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-99/church-hub-windows-x64-pr-99-7fa1eb2.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-99/church-hub-linux-x64-pr-99-7fa1eb2.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-afdaadd7c6b105ad4/.review-build/T-003/church-hub-T-003.app
commit 7fa1eb2a: the editor's form and slides rail are now shared Workspace panels (id song-editor): drag the divider to resize, Edit layout in the new More menu moves them, both stored per device. Title row sits above the panels (page no longer scrolls on large screens; sticky on phones). Tests: e2e/song-editor-layout.spec.ts (resize + move + reload) and song-editor-header-layout.spec.ts pass.
- 2026-10-05: Closed by the user. Song editor: no Programe, Slides on the right as resizable/movable panels (shared workspace, remembered per device), Edit as text in place, fixed title. PR #99 merged.
