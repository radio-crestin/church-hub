---
id: T-065
title: GitHub Actions and bots run only for trusted contributors
sprint: 2026-09-28
urgent: false
status: done
owner: ci-trust
rolled: 0
order: -20
created: 2026-10-04
---
## Goal
User 2026-10-04: "make sure that the github actions and bots are executed only from trusted/approved contributors".
Audit every workflow in .github/workflows and every bot/app on the repo (Claude/AI review bots, Dependabot, comment-triggered commands like `/test`, PR build, release, CodeQL, secret scan):
- Comment/label/workflow_dispatch triggers act only when github.event.comment.author_association (or the actor) is OWNER, MEMBER or COLLABORATOR.
- No pull_request_target / workflow_run that checks out or runs fork code with secrets or a write token; fork PRs get no secrets and read-only GITHUB_TOKEN; least-privilege `permissions:` per job; pin third-party actions to a commit SHA.
- PR builds/uploads to releases (pr-build-<n>, pr-demo-videos) only for trusted authors, never forks.
- Repo/org settings that need the user (e.g. "Require approval for all outside collaborators" for fork PR workflows, bot/app installs, branch protection): don't change them — list each with the exact click path for the user.
Prove it: a test PR/comment from a non-collaborator path is skipped (simulate via the condition logic or a dry run), trusted ones still run.

## Notes
- 2026-10-04: Details are kept in the private task notes (.claude/tasks-private/, not in git).
- 2026-10-04: User 2026-10-04: Mark as resolved (lead merges #95 when green). For the GitHub settings the user said "do it by yourself on the mac" — details of what to apply are in the private notes.
- 2026-10-04: Workflows run only for trusted contributors; actions pinned; GitHub settings applied (details in private notes). PRs #95 and #96 merged.

## PR
- branch:
- pr:
- video:
