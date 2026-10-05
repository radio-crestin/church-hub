---
id: T-079
title: Mark implemented feature requests with a green checkmark in the WhatsApp group
sprint: 2026-10-05
urgent: false
status: done
owner: whatsapp-requests
rolled: 0
order: -1
created: 2026-10-05
---
## Goal
User's words: "connect to /Users/iosif/Documents/Projects/bringes-infrastructure/environments/whatsapp_production and mark with green checkmark all the tasks which have been implemented from <group invite link, kept in .claude/tasks-private/whatsapp-requests.config.json> make sure to not leak any secrets.."

What to do:
- Use the WhatsApp production environment in bringes-infrastructure (environments/whatsapp_production) to read the messages of that WhatsApp group (invite link above).
- Find the messages that ask for a feature or report a bug (the "tasks").
- For each, check whether it is implemented in church-hub (merged on main: git log, merged PRs, docs/tasks.md, closed better-tasks tasks).
- React with a green checkmark (✅) only on messages whose request is clearly implemented and merged. Not sure → don't react; list it in the report instead.
- Don't post messages in the group, only reactions.

Secrets (required):
- Never print, copy, log or commit tokens, keys, session data, phone numbers or env values from bringes-infrastructure. Read them only through the environment's own tooling; don't cat .env / secret files into the transcript.
- Nothing from that repo goes into church-hub files, task notes, PRs or commits beyond plain message summaries.
- No edits to bringes-infrastructure.

Done = report in the task notes: a table of each request (short plain summary, no names/phone numbers) → implemented? → evidence (commit/PR/task id) → reacted ✅ or not, plus the unsure ones.

## Notes
- 2026-10-05: User decisions on the proposed list (scratchpad/wa/proposed-reactions.md): 1) react ✅ on all 36 "clearly implemented" messages, including #36, #46, #73 (done slightly differently). The 5 unsure ones get no ✅. 2) Check the 20 older messages with no task (#1, 2, 5, 8, 10, 11, 29, 32, 37, 40, 56, 59, 65, 67, 68, 72, 76, 84, 112, 116): user's words "check them, also verify if there are no already tasks for them, and if they are link to them". So for each: done? already covered by an existing task (open or closed)? → link the message to that task (in the report / the T-081 ledger). Show the lead the result before reacting on any of those 20.
- 2026-10-05: 2026-10-05: ✅ reacted (via WAHA, verified by re-reading the group) on all 36 approved messages: #3 4 7 9 12 14 17 36 45 46 49 51 57 62 66 69 73 75 82 83 91 92 120 121 122 123 126 128 135 152 160 190 191 192 193 197. Now checking the 20 older ones (task links + code), result to the lead before any reaction.
- 2026-10-05: User decisions on the older 20 (scratchpad/wa/older-20.md): react ✅ on #5, 8, 10, 32, 40, 112, 116 and also on #56 (T-025 stays open for the toggle rework). Backlog tasks created for the not-done ones: #2 → T-082, #65 → T-083, #76 → T-084. #59 is allowed on purpose: no task, no ✅. Unsure #1, 11, 29, 72: no ✅. Record all links (incl. #37→T-038, #56→T-025, #67→T-049, #68→T-045, #84→T-016) in the report and the T-081 ledger.
- 2026-10-05: Lead: 36 + 8 reactions approved by the user; teammate finishing the report.
- 2026-10-05: 2026-10-05 REPORT. Group "Church Hub Bugs": 197 messages, read through WAHA (session WORKING) with a scratchpad script that loads the API key in-process; no secret printed, nothing changed in bringes-infrastructure. 44 new ✅ reactions (only reactions, no messages posted), each verified by re-reading the group. "#n" = message position, oldest first.

| # | request | implemented? | evidence | ✅ |
|---|---|---|---|---|
| 3 | /api/songs returns 10 MB | yes | T-036, PR #77 | reacted |
| 4 | livestream screen hides the gama | yes | T-027, PR #111 | reacted |
| 5 | song font size remembered + A↓/A↑ | yes | 1fcad0c0 (#34) | reacted |
| 7 | marcaje edit as text | yes | T-005, PR #106 | reacted |
| 8 | X in Bible search refocuses input | yes | 303a5ad7 | reacted |
| 9 | program export includes gama | yes | T-017, PR #114 | reacted |
| 10 | songs page saves separator positions | yes | 7f4c9fbd | reacted |
| 12 | control-room monitor settings in Romanian | yes | T-033, PR #113 | reacted |
| 14 | programs accept "Ioan 3:16,17" | yes | T-015, PR #82 | reacted |
| 17 | Solo → song switches the scene | yes | T-019, PR #75 | reacted |
| 32 | screen opens on its chosen display | yes | 084480ec (#54) | reacted |
| 36 | hide a song category everywhere | yes (programs/bookmarks kept visible by design) | T-040, PR #80 | reacted |
| 40 | Logitech presenter remote | yes | 2bcbd0b8 | reacted |
| 45 | song edit history | yes | T-006, PR #102 | reacted |
| 46 | F-keys captured when another app is in front | yes (focus-only option) | T-041, PR #115 | reacted |
| 49 | shortcuts respect permissions | yes | T-041, PR #115 | reacted |
| 51, 126 | program scrolls to live slide verse → song | yes | T-020, 7f4c9fbd + PR #76 | reacted |
| 56 | preview on middle screen for singers | yes (preview selector; T-025 stays open for the toggle) | T-025 | reacted |
| 57 | add-song picker category/tag filters | yes | T-021, PR #112 | reacted |
| 62 | long song text edit scrolls | yes | T-009, PR #103 | reacted |
| 66 | projector window on top | yes | T-026, PR #81 | reacted |
| 69 | first/last slide animations in step | yes | T-007, PR #100 | reacted |
| 73, 193 | F5/F6 focus Bible search (default F6, configurable) | yes | T-012, PR #78 | reacted |
| 75, 135 | create program from Programe + "Azi" button | yes | T-024, PR #83 | reacted |
| 82, 83 | export song as PDF / Word | yes | T-008, PR #98 | reacted |
| 91 | edit toggles text / PowerPoint mode | yes | T-003, PR #99 | reacted |
| 92 | Versiuni under the song preview | yes | T-004, PR #105 | reacted |
| 112 | repeat signs stay on the last verse line | yes | 084480ec (#54) | reacted |
| 116 | history search ignores diacritics | yes | b2f28306 | reacted |
| 120, 121, 190, 191, 192 | verse bookmarks with annotations, MD/JSON import/export, underline saved + on projector | yes | T-010, PR #104 | reacted |
| 122, 123, 160 | gama in program edit, program view, song page program list | yes | T-022, PR #114 | reacted |
| 128 | clock in Solo scene | yes | T-023, PR #79 | reacted |
| 152 | slides projected with nobody presenting | yes (local e2e used :3000) | T-030, PR #74 | reacted |
| 197 | no scroll to top after adding a gama | yes | T-076, PR #116 | reacted |
| 37 | first-start progress bar | no | T-038 (open) | no |
| 67 | phone: settings menu missing | no | T-049 (open) | no |
| 68 | phone: song preview missing | no | T-045 (open) | no |
| 84 | looping welcome presentation | no | T-016 (open) | no |
| 2 | Bible verse slideshow mode | no | T-082 (new) | no |
| 65 | song missing from Resurse Crestine import | no | T-083 (new) | no |
| 76 | similar songs by theme | no | T-084 (new) | no |
| 59 | same song twice in a program | allowed on purpose (29892584) | none | no |

Unsure, no ✅: #1 music list scroll (fix fca9643a predates the report); #11 highlight not cleared (auto-clear predates, intermittent); #29 "si" vs "și" search (folding predates; exact query not tested); #72 nicer default screens (partly 5b8026fe); #93 fixed edit button while a slide shows (T-003, unclear); #188/189 feedback → WhatsApp/GitHub (PR #101 merged, worker not deployed, T-073); #13 weird characters in preview (decode fix in #89, not linked); #87 "Amin" missing on the last slide (no task/commit found); #33 gama not saved (🟡 by a member; same bug #42 already ✅).
Open tasks quoted in the group and still todo: T-011, 013, 016, 018, 025, 028, 029, 031, 032, 034, 035, 037, 038, 039, 042, 043, 044, 045-050.
Could not verify: behavior in the running app (evidence = merged code + commit dates). Commits: none (no code change). Scratch scripts in the session scratchpad (wa/), to be deleted after T-081.
- 2026-10-05: 44 implemented requests in "Church Hub Bugs" marked ✅ (36 + 8 older); not-done ones filed as T-082, T-083, T-084; links to open tasks in the notes.
