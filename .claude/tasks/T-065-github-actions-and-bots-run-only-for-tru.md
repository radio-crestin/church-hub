---
id: T-065
title: GitHub Actions and bots run only for trusted contributors
sprint: 2026-09-28
urgent: true
status: doing
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

## PR
- branch:
- pr:
- video:
