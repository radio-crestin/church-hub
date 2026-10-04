---
id: T-068
title: Release secrets usable only by release builds
sprint: 2026-10-05
urgent: true
status: doing
owner: repo-access
rolled: 0
order: -2
created: 2026-10-05
---
## Goal
User 05/10 chose "Lock the secrets": move the release signing and release-push secrets into a protected GitHub environment that only v* tag release builds can use; nobody's access changes; PR builds need another way to sign or stay unsigned. Details are kept in the private task notes (.claude/tasks-private/, not in git).

## Notes
- 2026-10-05: repo-access 2026-10-05: release environment (v* tags only) holds the signing key, its password and a new release deploy key; PR #107 makes release jobs use it, other builds go without. Waiting: lead OK to delete the repo-level copies after #107 merges. Details: .claude/tasks-private/T-068-notes.md
branch: fix/release-environment
pr: #107 https://github.com/radio-crestin/church-hub/pull/107
commits: 385d5b7e build-desktop · cc32b1ba build-release + docs
video: none (CI/settings only)

## PR
- branch:
- pr:
- video:
