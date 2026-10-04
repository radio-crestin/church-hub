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
- 2026-10-04: User (request changes): "make sure that tauri cache is re-used so that the testing is very fast". The worktree flow must reuse the main checkout's caches instead of rebuilding from zero.
- 2026-10-04: User: "make sure to clean up the worktree very fast and efficient when the task is finished".
- 2026-10-04: Cache reuse: app/scripts/worktree-setup.ts (bcae0827) + rule step 2 (181c6722). Fresh worktree to passing spec 16.4 s total (setup ~5 s). cargo check 17.9 s cold → 3.4 s via a shared target dir. Playwright 1217 shell installed by hand from the complete zip, because playwright install hangs at 100% here (Homebrew Node 26).
- 2026-10-04: Cleanup: app/scripts/worktree-cleanup.ts. Stops only the task port, then unlock, rename aside, prune, detached rm, branch deleted only if merged or pushed. Measured 0.81 s on a 2 GB locked worktree with a listener on its port; folder gone within 8 s; shared caches unchanged. Rules: teammate step 8, coordinator runs it on Accept.
