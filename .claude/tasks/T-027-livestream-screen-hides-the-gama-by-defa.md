---
id: T-027
title: Livestream screen hides the gama by default
sprint: 2026-10-05
urgent: false
status: done
owner: screens
rolled: 0
order: -5
created: 2026-10-04
---
## Goal
Chat 21/05 BCEV: «pe ecranul de livestream nu afisa gama». The key line can be turned off per screen, but the livestream defaults keep it on (defaultConfigs.ts ~171, ~450). Default it off for livestream screens.

## Notes
- 2026-10-05: 2026-10-05 done. branch: fix/livestream-gama-default
pr: #111 https://github.com/radio-crestin/church-hub/pull/111
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@b8054a2e9ce02d5000f3ee9c7098fcf4321e9eba/pr-demos-fix-livestream-gama-default/t027-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@b8054a2e9ce02d5000f3ee9c7098fcf4321e9eba/pr-demos-fix-livestream-gama-default/t027-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-111/church-hub-macos-arm64-pr-111-6968b7c.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-111/church-hub-windows-x64-pr-111-6968b7c.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-111/church-hub-linux-x64-pr-111-6968b7c.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a9ffc1046f60f646d/.review-build/T-027/church-hub-T-027.app
Changed: new livestream screens default song.displayKeyLine=false. The real default lives on the server (screens.ts adjustConfigForLivestream + seeded default-screens.json); client defaultConfigs.ts aligned too. Existing screens untouched (no backfill) - the operator can still toggle it.
Test: e2e/livestream-gama-default.spec.ts (livestream off, primary/stage on) passes; manual: add Livestream screen > Edit > Song > click lyrics > "Afișează tonalitatea" unchecked.
Commits: f32d3692, 6968b7cd. Not verified: existing installs' already-created livestream screen keeps the key on (by design).
- 2026-10-05: User review of PR #111 (2026-10-05): «but not the livestream should have this, but the stage monitor should have this by default..». So: livestream hides the gama by default (as done), and the stage monitor must show the gama by default. Check stage monitor defaults (client defaultConfigs + server create/seed) and make the key line on there.
- 2026-10-05: 2026-10-05 stage follow-up: I checked the stage defaults. A stage monitor already shows the gama by default, both the seeded "Stage" screen and a newly created one. The defaults leave displayKeyLine unset, which counts as on, and the songKey element is merged in on read. The new e2e spec proves it on the real projection page (/screen/:id): the key is visible on the first slide for the seeded stage screen and a new stage screen, and absent for a new livestream screen (7 passed). Commit 10dfe172, pushed to PR #111. No code change was needed for stage. Open question for the user: if their own existing stage monitor does not show the gama, that screen was switched off in its stored settings ("Afișează tonalitatea" off, or the song key element hidden). Defaults never touch existing screens, so it needs a manual toggle in the screen editor, or an explicit backfill if they want one.
- 2026-10-05: New livestream screens hide the gama by default (client + server create + seed); stage monitors keep showing it, proven by e2e. PR #111 merged.
