---
id: T-019
title: Solo → song in a program doesn't switch the OBS scene
sprint: backlog
urgent: false
status: todo
owner:
rolled: 0
order: 16
created: 2026-10-04
---
## Goal
Chat 24/05 BCEV [La Programe]: «cand se trece de pe solo in cantare nu se muta scena. (ramane pe solo)». useScheduleFlatNavigation.ts 330-357 switches the scene for scene items; obs/content-type-detector.ts has no 'scene' branch (treated as empty) and nothing switches back when a song follows. Fix with a test.

## Notes
