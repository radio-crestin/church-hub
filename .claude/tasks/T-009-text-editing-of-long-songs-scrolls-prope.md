---
id: T-009
title: Text editing of long songs scrolls properly
sprint: 2026-10-05
urgent: false
status: doing
owner: song-editor
rolled: 0
order: 2
created: 2026-10-04
---
## Goal
Chat 13/06 BCEV: «cant cantarea este foarte lunga, editarea ca si text nu face scroll cum trebuie (exemplu cantare Asteptam ceruri noi)». Reproduce with that song; the text mode syncs a gutter with textarea scrollTop (SongSlidesPanel.tsx ~134, 367, 384). Fix scrolling and keep the caret visible.

## Notes
