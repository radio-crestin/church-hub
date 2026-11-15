---
id: T-130
title: Client type check reports errors in song-import and the songs route
kind: task
level: normal
order: -16
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T21:27:30.492Z
---

## Goal
Found by the T-122 teammate (2026-10-06): the client typecheck (`tsc --noEmit` in app/apps/client) reports errors in the song-import feature and the songs route on main; they predate T-122. Fix them at the root so the client type check is clean.

## Notes

- 2026-10-07: 2026-10-07: commit 90b4534b on task/T-130 (pushed, no PR yet). song-import + routes/songs now type-clean: '/songs/'->'/songs' nav targets, removed dead song.key, Tauri drag 'cancel'->'leave' (real bug: the overlay could stay stuck), and null-safe progress total. Lint clean, song specs 55 passed. Scope question for lead: the client has ~220 more tsc errors elsewhere (presentation 90+, bible route 30, song-export, songs components, e2e specs). Full list in scratchpad/T-130-tsc.txt.
- 2026-10-07: Video: [T-130.mp4](../tasks_videos/T-130.mp4)
2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/167 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-130/church-hub-T-130.app. New e2e song-drop-overlay.spec.ts fails before the fix and passes after it. The rest of the client errors are in T-132.
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Song-import and songs routes type-check clean ('/songs' typed paths, dead song.key removed); Tauri drop overlay now listens for 'leave' so it no longer stays stuck. Merged PR #167. Remaining errors in T-132.
