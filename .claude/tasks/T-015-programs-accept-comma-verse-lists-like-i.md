---
id: T-015
title: Programs accept comma verse lists like "Ioan 3:16,17"
sprint: 2026-09-28
urgent: true
status: doing
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
