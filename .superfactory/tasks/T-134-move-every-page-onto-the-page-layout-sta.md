---
id: T-134
title: Move every page onto the page-layout standard (shared Page, PageHeader, PagePanel, EmptyState)
kind: task
level: normal
order: -20
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-07T00:00:00.000Z
updatedAt: 2026-10-07T00:00:00.000Z
---

## Goal
Follow-up of T-133 (2026-10-07). User's words: "i want the notification page to match the design of the other pages.. define a standard and try to be consistent". T-133 defined the standard (docs/page-layout.md; src/ui/page/{Page,PageHeader,PagePanel,EmptyState}.tsx) and moved the Notifications page onto it. Move the rest, from T-133's survey (file:line in T-133's newest note, /Users/iosif/Documents/Projects/church-hub/.claude/tasks/T-133-sidebar-notifications-just-a-bell-icon-w.md):
- Bigger: Schedules list, Gallery, Song key (double padding), Song discovery, Dashboard.
- Minor: Bible, Live Stream, Live Translation, Control room.
- Hand-written empty states (ScheduleList, SongList, SceneGrid, music FolderBrowser/Playlist/QueueList) -> EmptyState.
- Every page's hand-written h1 (14+) -> PageHeader.
- Settings: ReleaseNotesSection and About -> SettingsSection.
- Also check: schedule editor/presenter, songs/$songId, custom pages.
Start after T-133 (#168) and T-132 merge. Before/after screenshots per page in the video; mobile included.

## Notes

- 2026-10-07: 2026-10-07: started on task/T-134 (off 9dcf679c). BEFORE screenshots of 16 pages, desktop and mobile: scratchpad/T-134/shots/before-*.png. Pages split across 3 parallel helpers working on separate files (A: schedules, dashboard, gallery, song key, schedule editor; B: discovery, bible, livestream, live translation, control room; C: songs, music, scenes, about and release notes, custom pages).
- 2026-10-07: Video: [T-134.mp4](../tasks_videos/T-134.mp4)
2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/173 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-134/church-hub-T-134.app. Every listed page is moved onto the standard, committed one area at a time. PageHeader now wraps on a phone (discovery's title had been squeezed to one letter). EmptyState takes an optional action. Kept as they are, since PageHeader has no slot for them: the program page (title renamed in place), the song page (back button plus chips), custom pages (embedded webview) and Bible's "no translations" screens. New e2e page-layout-standard.spec.ts. Full suite: 827 passed, 1 flaky. BEFORE/AFTER screenshots: scratchpad/T-134/shots.
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Every page from T-133's survey on the page standard (shared header, panel, empty state); PageHeader wraps on phones (fixes Song discovery title squeezed to "D."); 4 special headers kept. Merged PR #173.
