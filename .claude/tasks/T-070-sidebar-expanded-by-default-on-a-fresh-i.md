---
id: T-070
title: Sidebar expanded by default on a fresh install
sprint: 2026-10-05
urgent: false
status: done
owner: sidebar
rolled: 0
order: -3
created: 2026-10-05
---
## Goal
User 05/10: «by default, the sidebar should be expanded on installation.. don't collapse it..». A fresh install (no saved preference) shows the main sidebar expanded; a user's own collapse choice is still remembered. Find why it starts collapsed today (default value, a width breakpoint, or a migration) and fix the root cause.

## Notes
- 2026-10-05: branch: fix/sidebar-expanded-by-default
pr: #108 https://github.com/radio-crestin/church-hub/pull/108
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@139afcc1954d6690f96fd1e8669f79ae608c6f7c/pr-demos-fix-sidebar-expanded-by-default/sidebar-default-on-a-fresh-install-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@139afcc1954d6690f96fd1e8669f79ae608c6f7c/pr-demos-fix-sidebar-expanded-by-default/sidebar-default-on-a-fresh-install-after.mp4
Root cause: ui/sidebar/sidebar.tsx defaulted a missing 'sidebar-collapsed' key to true, and a save-on-mount effect wrote that default back as if the user chose it. Fix: hook use-sidebar-collapsed.ts (empty storage = expanded, saves only on the user's toggle). Commit 8b743928. Spec: e2e/sidebar-default-expanded.spec.ts. No new strings (no Romanian needed). Installs that already saved 'true' stay collapsed (cannot tell from a real choice).
- 2026-10-05: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a9a448c6134ac67cb/.review-build/T-070/church-hub-T-070.app (port 4170, own empty data folder = a fresh install, built on 777471aa)
commits: 8b743928 (fix: start expanded, save only the user's click), 777471aa (sidebar brand is a span not an h1; dialog-escape and panel-header-overflow specs start collapsed via e2e/helpers/collapsed-sidebar.ts)
tests: new e2e/sidebar-default-expanded.spec.ts (3 tests) pass. Full suite on 1st commit: 640 passed, 10 specs failed; 9 were caused by the new default and are fixed in 777471aa (71 affected specs pass again). Not caused by this PR: schedule-songs-panel.spec.ts:317 'song editor drops the row buttons' fails the same on main (song editor hides the Programe column) -> song editor owner.
build: pending (CI pr-build for PR #108, ~25 min)
- 2026-10-05: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-108/church-hub-macos-arm64-pr-108-777471a.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-108/church-hub-windows-x64-pr-108-777471a.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-108/church-hub-linux-x64-pr-108-777471a.AppImage (build of 777471aa)
- 2026-10-05: Closed by the user. Fresh install starts with the sidebar expanded; a missing setting is no longer saved as collapsed. PR #108 merged.

## PR
- branch:
- pr:
- video:
