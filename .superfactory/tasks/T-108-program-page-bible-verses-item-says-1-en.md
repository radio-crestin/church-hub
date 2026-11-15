---
id: T-108
title: 'Program page: Bible verses item says "1 entries" in English'
kind: task
level: normal
order: -4
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T09:17:03.580Z
---

## Goal
Found by programs during T-018; the user wants it fixed now (2026-10-06). On a program's page with the app in Romanian, a "Versete Biblice" item shows "1 entries" in English (hard-coded in ScheduleItemsPanel.tsx around line 486). Move it to i18n with correct Romanian plural forms (one/few/other, like T-105), check that page for other hard-coded strings, e2e spec, PR with the 1080p before/after video.

## Notes

- 2026-10-06: Video: [T-108.mp4](../tasks_videos/T-108.mp4)
Done. Branch fix/program-entries-count (from main), commit ed9d54f9. ScheduleItemsPanel had two hard-coded English counts: "N entries" (Versete Biblice) now uses verseteTineri.entriesCount (ro one/few/other already existed), and "N verses" (older Bible passages) uses new presenter.versesCount (en one/other, ro one/few/other). No other hard-coded text on the page. Spec e2e/program-entries-count.spec.ts green; full suite after acceptance.
PR: https://github.com/radio-crestin/church-hub/pull/149
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app)
Question:
T-108 Program page: Romanian count for Bible verses
What changed: on a program's page in Romanian, a "Versete Biblice" entry now says "1 intrare" (or "2 intrari"), not "1 entries".
To try it: open the app in Romanian, open a program with Bible verses.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app
Is everything OK?
- 2026-10-06: Lead (2026-10-06): the Romanian strings shown are missing diacritics ("2 intrari" → "2 intrări"). The whole verseteTineri section of ro/schedules.json lacks them ("Sterge intrare", "Adauga cel putin o intrare valida", "Nume persoana", "Nicio traducere biblica", ...). Fix diacritics in that section (via Codex per project rules), update the spec and the video, then report done again.
- 2026-10-06: Change done: Romanian diacritics for the whole verseteTineri section (Codex-checked): "Adaugă Intrare", "Nicio intrare încă", "2 intrări", "20 de intrări", "Nume persoană", "Șterge intrare", "Adaugă cel puțin o intrare validă", "Nicio traducere biblică selectată". Specs updated (program-entries-count, program-verse-lists; T-018's spec already tolerant). Rebased onto main after T-018: commits 090318fc, ddcdb978. Related specs green. PR #149 and video updated.

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app)
Question:
T-108 Program page: Romanian count for Bible verses
What changed: a "Versete Biblice" entry now says "1 intrare", "2 intrări" (with diacritics), not "1 entries". The texts of the Bible verses dialog also have their diacritics now ("Adaugă Intrare", "Nume persoană").
To try it: open the app in Romanian, open a program with Bible verses, and add a "Versete Biblice" item.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-108/church-hub-T-108.app
Is everything OK?
- 2026-10-06: Main is red on tooltip-inside-window.spec (T-107 + T-087's open-left workaround in the Programe header). T-108's branch removes the workaround, which fixes it; merging T-108 turns main green again.
- 2026-10-06: Finished: full tests pass. e2e: 755/790 green (34 skipped, 1 unrelated flaky passed on retry: song-text-mode-scroll), 09a34e94. First run found main red on tooltip-inside-window.spec (T-107's arrow check vs the Programe panel's open-left tooltips); fixed here by opening them below again (09a34e94), since the shared tooltip now stays in the window. PR #149 updated.
- 2026-10-06: Program page: Bible verses item counts in Romanian ("1 intrare", "2 intrări"), diacritics fixed in the verses dialog, Programe header tooltips back to the shared placement (fixes main's red tooltip spec); full suite 755/790 green. PR #149 squash-merged.
