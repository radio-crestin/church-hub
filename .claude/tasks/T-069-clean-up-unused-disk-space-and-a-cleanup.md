---
id: T-069
title: Clean up unused disk space, and a cleanup step after every approved task
sprint: 2026-10-05
urgent: false
status: done
owner: disk-cleanup
rolled: 0
order: -2
created: 2026-10-05
---
## Goal
User 05/10: «make sure to cleanup unused disk things.. also add instruction in our project after each approved task to cleanup the things which are not used anymore».
1) One-time cleanup on this Mac: leftover worktrees of closed tasks (.claude/worktrees/), their .review-build apps, merged/stale local branches, old test DBs/dist/node_modules left by worktrees, Playwright download zips in $TMPDIR, old demo recordings, oversized shared caches (e.g. Cargo target) only if safe to rebuild. Also on GitHub: pr-build-<n> prereleases of merged/closed PRs and merged remote branches. Keep: the demo videos/GIFs embedded in PRs (pr-demo-videos branch, pr-demos-* assets), the user's main checkout, port 3000 dev server, church data, active teammates' worktrees, and anything not clearly unused. List what goes with sizes first; delete only the clearly unused; report the space freed.
2) Make it permanent: extend app/scripts/worktree-cleanup.ts (and/or teammate.md step 8 + the lead's accept flow) so that after each approved task everything that task created and no longer needs is removed: worktree, review build, branch (local + remote once merged), PR build prerelease, temp files.

## Notes
- 2026-10-05: User decisions 05/10:
1) Other projects' temp: delete all — /private/tmp/claude-501/-Users-iosif-Documents-Projects-best-remote-desktop, $TMPDIR brd-*, the bringes-infrastructure and better-tasks session temp folders (skip any folder a running process/session uses).
2) church-hub data: delete e2e/.test-data and the old upgrade backups app/data/app-v0.1.96.db, app-v0.1.102.db and app/data/old/; KEEP app/data/pgdata and the live DB.
Lead decisions: this session's scratchpad — delete everything of finished tasks (nightly/fresh/plugin targets, fresh-clone, codeql-db-*, t063, t057, demos of closed tasks); keep demos/files of active tasks T-005, T-010, T-067, T-070, T-069. Cargo: delete debug/incremental only. Keep the 8 unpushed branches.
- 2026-10-05: branch: chore/disk-cleanup
pr: #109 https://github.com/radio-crestin/church-hub/pull/109
(tooling: no before/after videos, no review app)
- 2026-10-05: Done 2026-10-05. Changed: app/scripts/worktree-cleanup.ts now also closes the review app + frees review port 4100+n, removes the review build (main-checkout folder, Cargo-target bundles, OS app folders), deletes the worktree-agent-* base branch, and once the PR is merged the remote branch and the pr-build-<n> release (new modules cleanup-github.ts, cleanup-review-build.ts; helpers in worktree-common.ts). review-build.ts now moves the bundle out of the shared Cargo target. teammate.md step 8 and coordinator.md accept flow updated (merge PR, then cleanup, then stop teammate). Commit 957e5519 (PR #109).
One-time cleanup: free space on the data volume 31 GiB -> 245 GiB (97% -> 73% full). 200 GB was old session temp of best-remote-desktop; plus brd-* 4.8, t057-* 7.5, scratchpad of finished tasks 6.5, review .app copies 5.1, e2e/.test-data 3.0, old upgrade DB backups 1.5, cargo debug/incremental 0.85, old logs 0.78. Git: 11 local PR-merged branches, 18 empty worktree-agent-* branches, 15 remote merged branches, 30 pr-build-<n> prereleases deleted. Kept: active worktrees/branches/PRs, live sessions, app/data/pgdata + live DB, 8 unpushed branches, scratchpad of T-005/T-010/T-067/T-069/T-070 and generic demos*/demos2-5 dirs (owner unclear, ~320 MB).
How to test: sandbox script /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/f24a82d0-2c32-4853-b9a2-02b74deef0a1/scratchpad/disk-cleanup/sandbox.ts (bun sandbox.ts <worktree root>): 5 scenarios (PR merged / open / unpushed / gh failing / review app running) ALL PASS. Real run: next accepted task, `bun app/scripts/worktree-cleanup.ts <id> <branch>` after `gh pr merge`.
Not verified: Windows/Linux runs (paths branch on process.platform, only macOS run); the sandbox script lives in the scratchpad, not in the repo (no test runner for app/scripts).
- 2026-10-05: Closed by the user. 214 GB freed; worktree-cleanup.ts now also removes the review app/port, review build, base branch, and after merge the remote branch and pr-build installers. PR #109 merged.

## PR
- branch:
- pr:
- video:
