---
id: T-136
title: "e2e: bookmark-drag-to-program sometimes drops onto the Programe panel without effect"
kind: task
level: normal
order: -22
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-07T00:00:00.000Z
updatedAt: 2026-10-07T10:00:37.429Z
---

## Goal
Found by the T-135 teammate (2026-10-07), full suite serial: bookmark-drag-to-program.spec.ts:83 fails once in a while with no toast on screen: the drop onto the Programe panel doesn't register (the program stays empty), then passes on retry. Log: /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/9474d1e1-01f2-42a5-9c21-080e52e9f21a/scratchpad/T-135-full.log. Find whether it's the test (drag timing, panel not ready) or the app (a drop that can be lost, which a user could hit too) and fix the root cause.

## Notes

- 2026-10-07: Video: [T-136.mp4](../tasks_videos/T-136.mp4)
2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/175 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-136/church-hub-T-136.app. A user can lose the drop: (1) dropped before the program list loads, the panel had no program and said "select a program first" (this was the flake, proven by logging the panel at each drop). Fix: hold the drop until the list loads. (2) Dropped onto a toast over the panel. Fix: find the drop zone through every layer at the release point. Two new e2e, each fails before its fix. Full suite: 831 passed, 1 flaky (page-scoped-shortcuts, unrelated).
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Two lost-drop app bugs fixed: a song dropped on Programe before the program list loads now waits and lands; a drop onto a toast over the panel finds the panel underneath. Two new e2e. Merged PR #175.
