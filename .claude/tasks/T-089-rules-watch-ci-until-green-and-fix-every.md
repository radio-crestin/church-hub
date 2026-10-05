---
id: T-089
title: "Rules: watch CI until green and fix everything before asking for approval and before each merge"
sprint: 2026-10-05
urgent: false
status: done
owner: rules
rolled: 0
order: -3
created: 2026-10-05
---
## Goal
User 2026-10-05: «make sure to update your instructions to monitor the tests before i approve and you fix all the things before merging each pr».

Edit .claude/rules/better-tasks.md (project additions to the better-tasks rules; keep its style: short bullets, keywords) so that:
- Teammates: after each push, watch the PR's CI runs (Test, pr-build, any other checks) until they finish; a red check is fixed at its root cause and pushed again, then watched again. Report done to the lead only when every check on the PR is green; put the green run link in the task notes.
- Lead: ask the user to test/approve a task only when its PR's checks are all green; before `gh pr merge`, check again that every check is green and nothing is unresolved (review comments, conflicts); if anything is red, send it back to the owner to fix, don't merge with `--admin` over a red check (`--admin` only passes branch protection rules, not red CI).
Don't touch the better-tasks plugin texts or .claude/tasks/config.json. One small commit on main (no AI co-author).

## Notes
- 2026-10-05: Done: .claude/rules/better-tasks.md gained Lead bullets "Green before asking" + "Before merging" (no merge over red, --admin is not a CI pass) and Teammate bullet "CI until green" (gh pr checks <n> --watch, fix root cause, CI: <url> note). Commit f1711043 on branch worktree-agent-ae1393c0b9f2a2bfe (agent was worktree-isolated, could not commit on main): lead runs `git cherry-pick f1711043` in the main checkout. Test: read the file. Not verified: nothing else to run.
- 2026-10-05: Rules now require every PR check green before asking approval and before merge; teammates watch CI until green and link the run.
