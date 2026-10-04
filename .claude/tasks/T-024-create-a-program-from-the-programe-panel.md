---
id: T-024
title: Create a program from the Programe panel, with a one-click "today" button
sprint: 2026-09-28
urgent: false
status: done
owner: programs
rolled: 0
order: -7
created: 2026-10-04
---
## Goal
Chat 30/08 Iosif: «din sectiunea de programe, nu se pot crea noi programe..»; 28/06 BCEV: «ar merge un buton sa precompleteze data de azi.» + «eventual aici (si cand se da click sa se faca si direct submit ca sa fie adaugat)» (photos 00003090/1). Add "new program" to the Programe panel, and a "today" button in the create form that fills today's date as the name and creates it in one click.

## Notes
- 2026-10-04 Done on branch feat/program-create-from-panel (rebased onto origin/main da693918).
  - The Programe panel header has a "Program nou" action (permission programs.create). It opens CreateScheduleModal (a name field plus "Azi"), and the new program is selected right away.
  - The green "Azi"/"Today" button (TodayProgramButton + useCreateTodayProgram) makes the program titled DD.MM.YYYY, or reuses it if it already exists. It is in the panel dialog, on /schedules/new, and next to "+" in the Adaugă în Program dialog, where the same click also adds the song (photo 00003091).
  - useUpsertSchedule now waits for the program list to refetch. Without this, the panel snapped back to the first program after a create.
  - i18n en+ro: panel.newSchedule, today.button, today.hint.
  - How to test: on a song page, in the Programe panel, click the green calendar+ button, then "Azi". Today's program is created and selected. Pressing it again creates no duplicate. Song toolbar → Adaugă în Program → "Azi": the song lands in today's program.
  - Tests: e2e program-create-from-panel 3 passed; vitest schedules 83 passed; schedule-songs-panel, schedules, page-actions-menu and schedule-rename pass. panel-header-overflow "narrowing…" fails on main too (pre-existing; resize drag off by 197px). Its action list now includes schedule-new.
  - Commits: b49ab1f4, e3c3f403. Not checked in the packaged app.
- 2026-10-04: PR lines (v3, with voice-over and red highlights; rebased onto origin/main 0247de61; commits 60809198 1700653d):
branch: feat/program-create-from-panel
pr: #83 https://github.com/radio-crestin/church-hub/pull/83
before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-create-from-panel-v3/t024-before-v3.mp4
after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-create-from-panel-v3/t024-after-v3.mp4
build: pending, "PR build #83" is queued (get the links later with pr-build-links.sh 83 --wait)
e2e program-create-from-panel passes after the rebase (4 passed, including setup).
- 2026-10-04: "Program nou" in the Programe panel + green "Azi" button (creates/reuses today's program; also in Adaugă în Program). PR #83.

## PR
- Branch: feat/program-create-from-panel
- PR: #83 https://github.com/radio-crestin/church-hub/pull/83
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-create-from-panel-v3/t024-before-v3.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-create-from-panel-v3/t024-after-v3.mp4
