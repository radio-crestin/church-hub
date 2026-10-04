---
id: T-052
title: Task workflow — worktree, tested, PR + branch on the task, demo video with cursor and notes
sprint: 2026-09-28
urgent: true
status: doing
owner: task-workflow
rolled: 0
order: -2
created: 2026-10-04
---
## Goal
User: "update the skill for implementing a feature/task, i want it to spawn a worktree, make sure to test the feature and record it using a video, make sure to extend the task with a pr id and branch.. make sure to attach the short video there demonstrating the fix or the new feature, add inside the video the mouse and some notes". Means the better-tasks teammate rules for this project (.claude/tasks/teammate.md, plus coordinator.md / task-template.md where needed): every task runs in its own git worktree on a feature branch; it is tested (e2e spec, Playwright against the worktree's own port); a short Playwright video shows the fix or feature with a visible mouse cursor and on-screen notes (captions); the task file gets `branch:` and `pr:` fields and the video link; the PR carries the video too. Reuse the documented-pr skill where it fits.

## Notes
- 2026-10-04: Done: rules in teammate.md (flow 1-7), coordinator.md, task-template.md (## PR section), config.json worktree:true; helper app/apps/client/e2e/helpers/demo-recording.ts; documented-pr reuses it + mp4. Commits c5d2319c, 7985d507, 95a06514. Traps: better-tasks drops unknown front-matter keys (so branch/pr/video live in the body ## PR section); GitHub release mp4 links download (octet-stream), only the inline GIF plays; Playwright 1.59.1 headless shell (1217) was missing, install very slow here, proof used executablePath to the 1243 shell.
