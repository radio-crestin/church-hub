---
id: T-015
title: Programs accept comma verse lists like "Ioan 3:16,17"
sprint: 2026-09-28
urgent: false
status: done
owner: programs
rolled: 0
order: -8
created: 2026-10-04
---
## Goal
Chat 24/05 Iosif: «in sectiunea de programe, ar trebui sa acceptam ca referinta corecta Ioan 3:16,17». parsePassageRange/parseReference treat a comma only as the chapter separator ("Geneza 1,1"). Support verse lists (3:16,17 and 3:16-18,20) in programs and Bible search.

## Notes
- 2026-10-04 Code done on branch feat/program-verse-lists (worktree agent-a1c17d5cf70b24ad9, port 3115). Not pushed yet: waiting on the T-053 highlight helper to record the videos.
  - Parser (client, bible/utils, OK'd by the bible owner): "Ioan 3:16,17" becomes 3:16-17. "Ioan 3:16-18,20" keeps its runs in `verseSegments`. A comma after a verse starts the next item of the list, so "Gen 1:1-2,5" is now 1-2 and 5; crossing chapters needs the same separator on both ends ("1:1-2:5" or "1,1-2,5"). "Geneza 1,1" still works.
  - Bible search box: a range or list goes to its first verse (3:16).
  - Server: entries and passages take optional `verseSegments`. The text holds only those verses and the reference is "Ioan 3:16-18,20". Add, update and Edit as Text share getEntryVerses and formatEntryReference. OpenAPI documents biblePassage, verseteTineriEntries and verseSegments.
  - Client: every save path goes through passageRangeToReadingFields. Edit as Text keeps a verse list with its reading on VT lines (splitReadingList). i18n placeholder and format hint updated (en, ro).
  - No DB migration: segments are not stored as a column. Edit re-parses the stored reference, so the gap survives an edit (covered by e2e).
  - Tests: vitest bible+schedules 223 passed; bun formatEntryReference 4 passed; e2e program-verse-lists 2 passed; bible, schedule-management, schedules and schedule-panel-presenting 44 passed.
  - Commits: c70e6828, 218f1519, f78bdbc6, e93c0db0.
  - Before video recorded without highlights (scratchpad demos/T-015-before). It will be re-recorded with the helper on a main build.
- 2026-10-04 Rebased onto origin/main (da693918). Commits are now 98518c4c, 185bf846, 4d7533d4, 20fbabf8 (they replace the hashes above). Videos re-recorded with highlights: before on a main build, after on this branch. Because the highlight helper draws behind modal dialogs, the demo also puts a red outline on the element.
- How to test: on the program page, Adaugă → Versete Biblice → type "Ioan 3:16,17" (shows Ioan 3:16-17) and "Ioan 3:16-18,20" (shows the list), then save. The reading's text leaves out verse 19. In the Bible search box, "Ioan 3:16,17" goes to 3:16.
- Not verified: the projector preview. In the e2e test DB it is blank for any Versete Biblice reading, even a plain range, and this branch does not touch rendering. Also not checked in the packaged app.
- 2026-10-04: PR lines (v3, with voice-over and red highlights; rebased onto origin/main 0247de61; commits 8bbcaf6a 4188d10b 843dcc95 c883681a):
branch: feat/program-verse-lists
pr: #82 https://github.com/radio-crestin/church-hub/pull/82
before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-verse-lists-v3/t015-before-v3.mp4
after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-verse-lists-v3/t015-after-v3.mp4
build: pending, "PR build #82" is queued (get the links later with pr-build-links.sh 82 --wait)
e2e program-verse-lists passes after the rebase (3 passed, including setup).
- 2026-10-04: Program readings accept verse lists ("Ioan 3:16,17", "3:16-18,20"); "Gen 1:1-2,5" now = verses 1-2 and 5. PR #82 (not merged yet).

## PR
- Branch: feat/program-verse-lists
- PR: #82 https://github.com/radio-crestin/church-hub/pull/82
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-verse-lists-v3/t015-before-v3.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-feat-program-verse-lists-v3/t015-after-v3.mp4
