---
id: T-022
title: Gama editable from program rows and the program edit view
sprint: 2026-10-05
urgent: true
status: doing
owner: programs-gama-2
rolled: 0
order: 0
created: 2026-10-04
---
## Goal
Chat 16/08 Iosif: «cand se editeaza programul, sa se scrie si gama fiecarei melodii» + «si deasemenea in view-ul de programe sa se afiseze gama (ca sa putem stii ce cantari nu au gama)»; 10/09 Bogdan: «Când ești într-o cântare și ai un program cu mai multe cântări, numai apare la cântările de la program gamele precum la cele marcate» (photos 00003183/4). v0.1.102 shows the gama read-only on ScheduleSongRow; make it visible everywhere in programs (incl. edit view, missing-gama hint) and editable like in Marcaje.

## Notes
- 2026-10-05: 2026-10-05 done (same branch/PR as T-017).
branch: feat/program-gama-export-edit
pr: #114 https://github.com/radio-crestin/church-hub/pull/114
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4bf9d29d1fcbbf72a81409910fcbcb9e31025535/pr-demos-feat-program-gama-export-edit/T-022-gama-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4bf9d29d1fcbbf72a81409910fcbcb9e31025535/pr-demos-feat-program-gama-export-edit/T-022-gama-after.mp4
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a446a4fb1196660bd/.review-build/T-017/church-hub-T-017.app (one build for both tasks)
Changed: 5c47c76e adds a gama chip on program page rows and on the song page's Programe list. A song without a gama shows a dashed "Fără gamă" hint. A click opens the KeyLineEditDialog through the shared useScheduleKeyLineEditor hook. Saving a key line now refreshes the ['schedule'] queries. a5d92172 makes Edit as Text save gamas changed between the braces (empty braces clear one, no braces leave it as is). It also fixes the pre-existing 'warning' ToastType error, now 'info'. 5949640c adds e2e/program-gama.spec.ts.
Test: CI=1 TEST_PORT=3117 bunx playwright test e2e/program-gama.spec.ts --workers=1 --retries=2. Manual: open a program, click "Fără gamă" on a song, type a gama, save → the chip updates. Open a song in that program and use the right panel the same way. In Edit as Text, change {…} and apply.
Not verified on real devices.
- 2026-10-05: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-114/church-hub-macos-arm64-pr-114-5949640.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-114/church-hub-windows-x64-pr-114-5949640.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-114/church-hub-linux-x64-pr-114-5949640.AppImage (commit 5949640)
- 2026-10-05: User review (2026-10-05): «same observation at t-017, are they duplicate?». Not duplicates: T-017 = exports, T-022 = gama shown/edited in the app; they share PR #114. The markdown-export request is tracked on T-017. Re-ask both together once the markdown export is in.
