---
id: T-009
title: Text editing of long songs scrolls properly
sprint: 2026-10-05
urgent: false
status: done
owner: song-editor
rolled: 0
order: 2
created: 2026-10-04
---
## Goal
Chat 13/06 BCEV: «cant cantarea este foarte lunga, editarea ca si text nu face scroll cum trebuie (exemplu cantare Asteptam ceruri noi)». Reproduce with that song; the text mode syncs a gutter with textarea scrollTop (SongSlidesPanel.tsx ~134, 367, 384). Fix scrolling and keep the caret visible.

## Notes
- 2026-10-05: branch: fix/song-text-mode-scroll (stacked on feat/song-editor-slides-right)
pr: #103 https://github.com/radio-crestin/church-hub/pull/103 (base = T-003 branch; retarget to main once #99 merges)
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@b576cbcb69584b2b866bbdf044bef152d1a34c08/pr-demos-fix-song-text-mode-scroll/song-text-scroll-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@b576cbcb69584b2b866bbdf044bef152d1a34c08/pr-demos-fix-song-text-mode-scroll/song-text-scroll-after.mp4
build: pending (CI running; links in /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/f24a82d0-2c32-4853-b9a2-02b74deef0a1/scratchpad/builds-103.txt)
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-afdaadd7c6b105ad4/.review-build/T-009/church-hub-T-009.app
Root causes (SongSlidesPanel): text opened scrolled to the end (caret at end on focus); wheel dead over green play buttons; gutter moved via React state; text box only 200px on phones. Test: e2e/song-text-mode-scroll.spec.ts. Not verified: the real "Asteptam ceruri noi" song (reproduced with a 60-slide song).
- 2026-10-05: Rebased onto the updated T-003 branch (c652e433), PR #103 base = feat/song-editor-slides-right, force-pushed. App rebuilt: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-afdaadd7c6b105ad4/.review-build/T-009/church-hub-T-009.app. CI builds for the new push: see /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/f24a82d0-2c32-4853-b9a2-02b74deef0a1/scratchpad/builds-103.txt when ready. Videos unchanged.
- 2026-10-05: build (rebased c652e433): https://github.com/radio-crestin/church-hub/releases/download/pr-build-103/church-hub-macos-arm64-pr-103-c652e43.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-103/church-hub-windows-x64-pr-103-c652e43.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-103/church-hub-linux-x64-pr-103-c652e43.AppImage
- 2026-10-05: Rebased on main (3c2d8a05), force-pushed, PR #103 targets main.
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-103/church-hub-macos-arm64-pr-103-3c2d8a0.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-103/church-hub-windows-x64-pr-103-3c2d8a0.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-103/church-hub-linux-x64-pr-103-3c2d8a0.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-afdaadd7c6b105ad4/.review-build/T-009/church-hub-T-009.app
Tests on the rebased branch: song-text-mode-scroll (3 repeats) and song-edit-preserves-metadata pass.
- 2026-10-05: Closed by the user. Text mode on long songs opens at the top, wheel scrolls over the play buttons, taller box on phones, caret stays visible. PR #103 merged.
