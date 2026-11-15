---
id: T-092
title: "Recording: remove the project's own video tooling, use better-tasks' default (always up to date)"
kind: task
level: normal
order: -2
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T17:19:22.754Z
---

## Goal
User (2026-10-05): «cleanup any local thing for recording, use default better-tasks.. when i update it make sure that it's also in the project updated».

Done means:
- Find every project-local recording/video tooling: scripts, skills, hooks, config, docs and rules that make teammates record demo videos their own way (e.g. .claude/skills/documented-pr scripts, custom capture/*.capture.ts files, rules in .claude/rules/better-tasks.md, .claude/tasks/ customizations, copies of plugin files). Remove them, or point them to the better-tasks plugin's own video tooling.
- The project uses the plugin's default recording directly from the installed plugin (no copied or pinned version), so updating the plugin automatically updates the project. If anything in the project has to stay (config), it must not shadow the plugin's defaults.
- Check that a teammate following the rules after the cleanup records a video with the plugin's default tool.
- Related earlier work: T-075 (dropped older better-tasks overrides).
- Don't touch the feature code that T-090 (feature-request-3) and T-091 (slide-design) are editing; they will stop writing their own capture scripts.

## Notes

- 2026-10-05: PR: https://github.com/radio-crestin/church-hub/pull/123 (branch chore/use-plugin-default-recording, commit c398b5c5)
Video: none, nothing to see on screen (tooling only).
Removed: .claude/skills/documented-pr/ (SKILL.md, record-features.sh, upload-demos.sh) and app/apps/client/e2e/helpers/demo-recording.ts + demo-voice.ts. Why: the project's own recorder (Playwright overlay, macOS say voice, GIF + jsDelivr upload); no spec imports the helpers.
Kept: pr-build-links.sh (installer links, not recording), moved to .claude/skills/detailed-pr/scripts/; the rules use the new path. cleanup-github.ts / worktree-cleanup.ts still never delete the pr-demo-videos branch or pr-demos-* releases, because old PRs embed those videos. Old changelog/CHANGELOG mentions are history and stay.
Edited: .claude/rules/better-tasks.md (one Video line: only the plugin's video rules and its demo-video.sh), CLAUDE.md and detailed-pr no longer point to /documented-pr.
Project config: .claude/tasks/config.json only switches demoVideos on, which is a plugin setting and doesn't override anything. .claude/settings.json enables the plugin from its GitHub marketplace with no version pinned.
NEEDS THE USER (outside the repo): ~/.claude/plugins/installed_plugins.json has better-tasks installed twice, at user scope 0.7.1 and at project scope for church-hub 0.9.0. Each copy updates separately, which is why an update doesn't always reach the project. Fix: keep a single install, e.g. `claude plugin uninstall better-tasks@better-tasks --scope project`, then `claude plugin update better-tasks@better-tasks`.
How to check: `grep -rn "documented-pr\|demo-recording\|demo-voice" CLAUDE.md .claude app/apps/client/e2e` finds nothing. The only video instructions a teammate gets are the plugin's injected rules, which call <installed plugin>/bin/demo-video.sh.
Not verified: an actual teammate recording run after the change.
- 2026-10-05: CI: all 12 checks green on PR #123 (https://github.com/radio-crestin/church-hub/actions/runs/37342694028). The Test workflow doesn't run for this PR because it only touches tooling paths.
- 2026-10-05: Resolved by the user. Removed the project's own recorder (documented-pr skill, demo-recording/demo-voice helpers); teammates record only with the plugin's demo-video.sh. PR #123 merged.
- 2026-10-05: User 2026-10-05, after the merge: «actually you can use our own recording.. if that's better, but record it at 1080p and follow the instructions of better-tasks».
So: videos must be 1080p (1920×1080) and follow the plugin's before/after video rules (where the file goes, the Video: line, PR attach). Choose the tool that gives the better result: keep the plugin's demo-video.sh if it can record 1080p well (it also stays up to date with the plugin, which the user wanted). Bring back our own recorder (removed in PR #123, commit c398b5c5, restorable from git) only if the plugin's tool can't do 1080p or its videos are clearly worse. Say which you chose and why in the notes. Put the 1080p rule in one line in .claude/rules/better-tasks.md (Video line).
- 2026-10-05: 1080p follow-up, done in the same PR as T-093: https://github.com/radio-crestin/church-hub/pull/125 (commit 5b74185c). CI green: https://github.com/radio-crestin/church-hub/actions/runs/37345582926
Chose the plugin's demo-video.sh, not our old recorder. Why: from better-tasks 0.9.0 it fits the video to 1920x1080 (quality medium/high; 0.7.1 capped at 1280x720), adds voice, red boxes/arrows and the PR poster, and updates with the plugin. The old recorder made GIFs uploaded via jsDelivr. Its one useful lesson, kept in the rule: Playwright records 800x600 unless recordVideo.size is set.
Changed: .claude/rules/better-tasks.md Video line: capture at 1920x1080 (Playwright viewport + recordVideo.size), run `demo-video.sh spec.json --quality high`, plugin >= 0.9.0.
Needs: this machine's user-scope install is 0.7.1 (1280 cap) until the user runs the T-093 steps (update to latest).
Not verified: a real 1080p recording run.
- 2026-10-05: Resolved by the user. Videos at 1920x1080 with the plugin's demo-video.sh (>= 0.9.0, --quality high); the rule is in .claude/rules/better-tasks.md. PR #125 merged.
