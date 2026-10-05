---
id: T-017
title: Program export includes the gama
sprint: 2026-10-05
urgent: false
status: done
owner: programs-gama-2
rolled: 0
order: -1
created: 2026-10-04
---
## Goal
Chat 24/05 BCEV: «cand se exporta programul adauga si gama». generateChurchProgramJson.ts 17-24 writes key: null and generateScheduleText.ts has no keyLine, although ScheduleItem.keyLine is filled by the server.

## Notes
- 2026-10-05: 2026-10-05 done (shared branch/PR with T-022).
branch: feat/program-gama-export-edit
pr: #114 https://github.com/radio-crestin/church-hub/pull/114
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4bf9d29d1fcbbf72a81409910fcbcb9e31025535/pr-demos-feat-program-gama-export-edit/T-017-export-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4bf9d29d1fcbbf72a81409910fcbcb9e31025535/pr-demos-feat-program-gama-export-edit/T-017-export-after.mp4
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a446a4fb1196660bd/.review-build/T-017/church-hub-T-017.app
Changed (ff4f3436): the churchprogram JSON now writes song.key = the song's key line, so it is no longer null. Importing the file sets keyLine on newly created songs; before, it sent a `key` field that upsert ignores. The program text (Edit as Text + schedule.txt in the zip) writes `Title #12 {Re major} [S]`, with `{}` when a song has no gama, and the parser reads it back.
Test: open a program and Save to File as a church program → each song's "key" is its gama. e2e/program-gama.spec.ts "the saved program file keeps each song gama".
Not verified: the native Tauri save dialog (only the browser download was tested), and importing a file that creates a new song.
- 2026-10-05: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-114/church-hub-macos-arm64-pr-114-5949640.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-114/church-hub-windows-x64-pr-114-5949640.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-114/church-hub-linux-x64-pr-114-5949640.AppImage (commit 5949640, covers T-017 and T-022)
- 2026-10-05: User review of PR #114 (2026-10-05): «but i want the gama to also be in the markdown export (simplified and detailed one..)». Add the gama to both markdown exports (simplified and detailed), same PR #114.
- 2026-10-05: User answer (2026-10-05) on which markdown export: «they have, when i edit the schedule as text.. that's kind of the export..». So "simplified and detailed" = Edit as Text plain view and normal view. Teammate says both already show the gama on PR #114. Verify on the PR #114 build that both views show the gama for every song (incl. after reopening), fix anything missing, and record a short before/after of both views for the re-review.
- 2026-10-05: Markdown-export follow-up (Edit as Text = the export; plain view = simplified, normal view = detailed). Checked: both views already carried the gama from ff4f3436, so no app code was missing. Detailed view: `Title #12 {Re major} [C]`, `{}` when a song has none, plus `Title (Re major)` in the Schedule Content section. Plain view: `Title (Re major)`, just the title when a song has none. c16197e7 extends e2e/program-gama.spec.ts: after changing a gama in Edit as Text and reopening it, both views show every gama (5/5 pass, --workers=1 --retries=2). Recorded on origin/main (before) vs the branch (after):
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@b23e53621690f742c00d66f30d231c59737efff2/pr-demos-feat-program-gama-export-edit/T-017-text-views-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@b23e53621690f742c00d66f30d231c59737efff2/pr-demos-feat-program-gama-export-edit/T-017-text-views-after.mp4
Both videos are embedded in the PR #114 body. The local app has been rebuilt at the same file:// link. CI installers for c16197e7 come from pr-build.yml (the app code is unchanged since 5949640, so the earlier installers show the same behavior).
- 2026-10-05: Program file export, zip schedule.txt and both Edit as Text views carry each song's gama; import keeps it. PR #114 merged.
