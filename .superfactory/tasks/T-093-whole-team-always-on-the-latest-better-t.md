---
id: T-093
title: Whole team always on the latest better-tasks plugin
kind: task
level: normal
order: -2
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T17:19:59.032Z
---

## Goal
Follow-up of T-092. Found there: better-tasks is installed twice on the user's machine (user scope 0.7.1, project scope for church-hub 0.9.0), so updating one copy doesn't update the other. The lead proposed removing the project-scope copy; the user answered (2026-10-05): «but we want the entire team to get the latest plugin..».

Done means:
- Everyone who clones church-hub and opens Claude Code gets better-tasks from the project's settings (.claude/settings.json: marketplace + enabled plugin), and gets the latest version automatically, without manual update steps. Check the current Claude Code docs (claude-code-guide agent or Context7) for how marketplace/plugin auto-update works at project scope, and what can be set in the repo vs. per machine.
- One install per machine, no stale second copy: tell the lead the exact steps the user has to run on their own machine (which scope to keep, which to remove), with the reason. Don't edit ~/.claude yourself.
- A short note for teammates/contributors (in the existing better-tasks rules or README, one line, no new doc) if they need to do anything.
- PR with CI green.

## Notes

- 2026-10-05: PR: https://github.com/radio-crestin/church-hub/pull/125 (branch chore/better-tasks-auto-update, commit 20ed671d)
CI: all checks green (CodeQL, gitleaks): https://github.com/radio-crestin/church-hub/actions/runs/37344355954
Video: none, config only.
Changed: .claude/settings.json marketplace entry better-tasks gets "autoUpdate": true. Docs (code.claude.com/docs/en/plugins/install.md): third-party marketplaces default to auto-update OFF; with it on, Claude Code updates the plugin in the background after each start (a restart loads it). That is why nobody got new versions automatically.
.claude/rules/better-tasks.md Teammates: one Plugin line (one user-scope install per machine, never a second project-scope copy).
Docs also say: the committed enabledPlugins + extraKnownMarketplaces enable the plugin for a collaborator but do not download it; each collaborator installs once (`claude plugin install better-tasks@better-tasks`). This cannot be removed from the repo side.
USER STEPS (own machine, I did not touch ~/.claude): `claude plugin uninstall better-tasks@better-tasks --scope project` (removes the stale church-hub copy, now 0.9.0 but it updates separately), keep the user-scope one (it also serves your other projects), then `claude plugin update better-tasks@better-tasks --scope user` (0.7.1 -> latest) and restart. Optional: add "autoUpdate": true to the better-tasks entry in ~/.claude/settings.json extraKnownMarketplaces so other projects auto-update too.
Not verified: an actual auto-update on a new release (needs a new better-tasks version to come out); whether the project-level autoUpdate also drives a user-scope install (the setting is per marketplace, which is shared on the machine, so it should).
- 2026-10-05: Resolved by the user. The project marketplace entry has autoUpdate: true; rule: one user-scope install per machine. PR #125 merged. The user asked the lead to run the machine steps.
- 2026-10-05: Lead ran the machine steps for the user (2026-10-05): user-scope copy updated 0.7.1 → 0.9.0, project-scope copy uninstalled, "autoUpdate": true added to better-tasks in ~/.claude/settings.json. Gotcha: `claude plugin uninstall ... --scope project` also empties "enabledPlugins" in the committed .claude/settings.json, which would turn the plugin off for the whole team. Restored it with git checkout; never commit that change. Needs a Claude Code restart to load 0.9.0.
