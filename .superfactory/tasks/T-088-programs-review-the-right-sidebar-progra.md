---
id: T-088
title: "Programs: review the right-sidebar Programe panel and create programs there"
kind: task
level: normal
order: 8
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.844Z
---

## Goal
User (2026-10-06), after seeing PR #138 (programs list in the LEFT sidebar): "no, drop it, this was refering on the rigth sidebar, like marcaje we already have programe.. make sure to review it and that the user can also create the programe there..". So: drop the left-sidebar version (close PR #138 unmerged, delete its branch). The request is about the RIGHT sidebar, where the Marcaje panel is and a Programe panel already exists. Review that Programe panel (bugs, missing parts, how it compares to Marcaje) and make sure the user can create a new program from it. The /schedules page and the left sidebar stay as they are. Overlaps T-086 (a minimal program view next to the bookmarks): check and say if T-086 is already covered. Done = PR with the 1080p before/after video, full e2e green.

## Notes

- 2026-10-06: 2026-10-06 owner programs. Original message (2026-07-30, after "a section showing a program styled like Marcaje"): "si apoi sa renuntam la acel view de programe.. si cumva tot management-ul sa se faca pe sidebar..". Design: the left sidebar's Programe entry expands into the list of programs (open, new, Today, import, per-row rename/export/delete, search); the /schedules list page goes away (/schedules opens the last program, or a short empty state pointing to the sidebar). The program editor page stays. Branch feat/programs-in-sidebar, port 3188.
- 2026-10-06: User decision (2026-10-06): keep the schedules page (/schedules, the full-page programs list). Do NOT remove it. The sidebar's Programe entry still gets the program list and management (open, new, Today, import, search, rename/export/delete), in addition to the page.
- 2026-10-06: Done (local build ready). Branch feat/programs-in-sidebar, commits 07706b4d, e56df3ee. What changed: the sidebar's Programe entry now lists every program under it (newest first, open program highlighted, item count), with a chevron to fold the list (remembered); "+ Program nou" (dialog with Azi/Today), import from file; each row's ⋯ menu: rename, save to file, delete (asks first). More than 8 programs: a filter box (title matches first, then programs found by their songs/verses), with the X clear button. The icons-only sidebar hides the list. The programs page (/schedules) stays as it was (user decision); it now saves/imports through the same hooks. Spec: app/apps/client/e2e/programs-sidebar.spec.ts (7 tests) green with schedule-rename, program-create-from-panel, schedules, schedule-songs-panel, sidebar-config, sidebar-default-expanded, search (all passed). Full suite not run yet (after acceptance). Not verified: phone drawer by hand (layout keeps the list in the drawer).
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app (close the app window to stop it; it is removed by the merge cleanup). BEFORE/AFTER screenshots in my scratchpad (before/, after/).

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app)
Question:
T-088 Programs: manage programs from the sidebar
What changed: under "Programe" in the left menu you now see all your programs. Click one to open it. The small arrow folds the list. "Program nou" makes a new one (or today's). The ⋯ next to a program renames it, saves it to a file or deletes it. With many programs, a search box appears on top. The Programe page stays as before.
To try it: open the app, look under "Programe" in the left menu, open a program, then try ⋯ and "Program nou".
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app
Is everything OK?
- 2026-10-06: e2e: 744/778 green (34 skipped, 0 failed, 0 flaky), e56df3ee. Full suite, local, serial: CI=1 TEST_PORT=3188 bunx playwright test --workers=1 --retries=2.
- 2026-10-06: Video: [T-088.mp4](../tasks_videos/T-088.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/138
- 2026-10-06: Left-sidebar version (PR #138) rejected by the user; goal rewritten for the right-sidebar Programe panel.
- 2026-10-06: Video: [T-088.mp4](../tasks_videos/T-088.mp4) (new, right-side panel)
Done (right-side Programe panel). Branch feat/programe-panel-review, commits b9e06aa4, a8bc77f8. Making a program there: green + beside the picker (dialog with Azi), a new name typed in the picker creates it, no-programs state offers Program nou + Azi (it used to say "create on the Programs page"), empty program offers Adaugă. Review fixes: delete needs programs.delete, removing rows needs programs.edit, passage highlight no longer matches Ioan 3:1 to 3:16. Found, not changed: no sung/remaining filter like Marcaje; a failed load looks empty; unused props passed by the song/Bible pages. Spec e2e/programe-panel-create.spec.ts + existing panel specs green; full suite after acceptance (plugin rule).
T-086 check: the panel already shows a program next to Marcaje on the song and Bible pages, with songs and passages, and clicking a verse step presents it. Not covered: the "minimal UI with only title + verses read" and the left-side preview verse by verse; that stays for T-086.
PR: https://github.com/radio-crestin/church-hub/pull/143
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app)
Question:
T-088 Programe panel: make programs there
What changed: in the Programe panel next to Marcaje, a green + makes a new program (or today's). You can also type a new name in the program list and create it. With no program yet, the panel shows "Program nou" and "Azi". An empty program shows "Adaugă".
To try it: open a song, open the Programe panel on the right, click the green +.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app
Is everything OK?
- 2026-10-06: User on PR #143 (2026-10-06), request changes: "when there is no schedule or songs inside a schedule, don't offer the add buttons inside.. also make sure that each button has a tooltip and the right icons which are intuitive and easy to use". So: no "Program nou"/"Azi" buttons in the no-programs state and no "Adaugă" in an empty program (the green + in the header stays the one way to create); every button in the panel gets a tooltip (en + ro) and a clear, intuitive icon. Update PR #143 and its video.
- 2026-10-06: Changes done (user's PR comment). Commits f44c6ab0, 8c32ffba on feat/programe-panel-review. Empty states have no buttons (no programs: points to the green +; empty program: how to fill it). One way to create: header green + (icon now a plain +); the picker's extra + removed; typed new name in the picker still creates. Icons: add-to-program = list-plus, marked-songs-to-program = bookmark. Every header button has a tooltip + accessible name; add tooltip = "Adaugă o cântare sau un verset în program"; drag handles say "Trage ca să schimbi ordinea". Panel specs 53 passed. Video and PR #143 updated.

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app)
Question:
T-088 Programe panel: make programs there
What changed: empty panels no longer show add buttons; they just say what to do. The green + at the top of the panel makes a new program. Every button at the top shows what it does when you point at it, with clearer icons.
To try it: open a song, open the Programe panel on the right, point at the buttons at its top, then click the green +.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app
Is everything OK?
- 2026-10-06: User on PR #143 (2026-10-06), request changes: "add also a plus button next to alege un program selector" → a + button right next to the "Alege un program" picker that creates a new program (with tooltip). Update PR #143 and the video.
- 2026-10-06: User (2026-10-06), follow-up: "and actually move the button from top there.." → don't add a second +: MOVE the green + from the panel header to right next to the "Alege un program" picker (one create button, beside the picker, with tooltip).
- 2026-10-06: Change done: the green + moved from the panel header to right next to "Alege un program" (tooltip "Program nou"); header keeps only actions on the picked program. Commit d2da626f. Panel specs 49 passed. PR #143 and video updated.

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app)
Question:
T-088 Programe panel: make programs there
What changed: the green + now sits right next to "Alege un program" in the Programe panel, not at the top. Pointing at it says "Program nou".
To try it: open a song, open the Programe panel on the right, click the green + next to the program list.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-088/church-hub-T-088.app
Is everything OK?
- 2026-10-06: Finished: full tests pass. e2e: 749/783 green (34 skipped, 0 failed, 0 flaky), 3c3de8ec (main merged in). PR #143 updated.
- 2026-10-06: Right-sidebar Programe panel: the green + beside "Alege un program" creates a program; no add buttons in empty states; tooltips and clearer icons; review fixes (delete/edit permissions, passage highlight). Full suite 749/783 green. PR #143 squash-merged.
