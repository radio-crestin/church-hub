---
id: T-018
title: Program quick-insert bar between entries
kind: task
level: normal
order: 11
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-04T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.843Z
---

## Goal
Chat 24/05 BCEV: «ar trb simplificat modul de a adauga versete / solo intre cantari/versete. (e.g. sa fie o bara, cu 2-3 butoane cele mai folosite intre entrys)». Today insert-after is in a per-item menu. Show a thin bar between entries with the 2-3 most used inserts (verses, solo/scene, song).

## Notes

- 2026-10-06: Video: [T-018.mp4](../tasks_videos/T-018.mp4)
Done. Branch feat/program-quick-insert-bar (from main), commit 9fb78479. Program page: a thin bar between two entries (shown on hover, always on touch) with Cântare / Versete Biblice / Scenă OBS; inserts right after the entry above (song opens straight at the song search), add menu does not reopen after; tooltips name the entry; only with programs.edit. No API change (afterItemId already supported). Not in the narrow Programe panel. Spec e2e/program-quick-insert-bar.spec.ts + related program specs (40) green; full suite after acceptance. BEFORE capture taken from this build without hovering (the bar is invisible then, so the page looks as on main).
PR: https://github.com/radio-crestin/church-hub/pull/147
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app)
Question:
T-018 Quick-insert bar between program entries
What changed: on a program's page, point between two entries: a small bar shows "Cântare", "Versete Biblice" and "Scenă OBS". What you add lands right there, not at the end.
To try it: open a program, point between two songs, click "Cântare", pick a song.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app
Is everything OK?
- 2026-10-06: User on PR #147 (2026-10-06), request changes: "display an insereaza element and open the modal selector" → instead of three buttons (Cântare / Versete Biblice / Scenă OBS), the bar between entries shows ONE button "Inserează element"; clicking it opens the existing add-item modal (selector), and what's picked lands at that spot. Update PR #147 and the video.
- 2026-10-06: Change done: one "Inserează element" button between entries (tooltip "Inserează un element după „…”") opens the usual add menu; the pick lands after the entry above. Branch rebased onto main (after T-087), commits a57a56a9, ebf48430. Related specs (34) green. PR #147 and video updated.

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app)
Question:
T-018 Insert between program entries
What changed: on a program's page, point between two entries: one button "Inserează element" appears. It opens the usual add menu, and what you pick lands right there, not at the end.
To try it: open a program, point between two songs, click "Inserează element", pick "Cântare" and a song.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-018/church-hub-T-018.app
Is everything OK?
- 2026-10-06: Finished: full tests pass. e2e: 753/787 green (34 skipped, 0 failed, 0 flaky), ebf48430 (up to date with main). Then a spec-only commit 5fa57d39 (verses step accepts the diacritics T-108 adds); that spec rerun green. PR #147 updated.
- 2026-10-06: Program page: an "Inserează element" button between entries opens the add menu and inserts at that spot; full suite 753/787 green. PR #147 squash-merged.
