---
id: T-068
title: Release secrets usable only by release builds
sprint: 2026-10-05
urgent: false
status: done
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
- 2026-10-05: repo-access 2026-10-05 done: #107 merged (76f8e4a8). The release secrets exist now only in the release environment; the repo-level copies and the old deploy key are deleted. Probe: a branch sees no secrets and is refused the environment; a v* tag gets them. Probe and temporary branches, runs and deployments are deleted. Backup: ~/.tauri plus 1Password vault church-hub, item "Church Hub updater signing key". Not verified yet: the next real release. Details: .claude/tasks-private/T-068-notes.md
- 2026-10-05: Closed by the user. Release keys live only in a v*-only release environment; old repo-level copies removed; key backed up locally and in 1Password. PR #107 merged. Details in the private notes.

## PR
- branch:
- pr:
- video:
