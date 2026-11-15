---
id: T-133
title: "Sidebar notifications: just a bell icon with a dot, on the Settings line, to the right"
kind: task
level: normal
order: -18
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-07T00:00:00.000Z
updatedAt: 2026-10-07T00:00:00.000Z
---

## Goal
User's words (2026-10-07): "update the notification to be just a bell icon, with a dot when there is something, on the same line with settings but to the right..".
Screenshot: the current sidebar item, a round bell icon with the label "Notificări" on its own row.
=> Replace the "Notificări" sidebar row (added in T-120) with an icon-only bell button placed on the same row as Settings, at its right end. When there are unread notifications, show a small dot on the bell (no number). Clicking it opens the Notifications page as before. Keep an accessible label/tooltip (EN + RO), and make it work in the collapsed sidebar and on mobile.

## Notes

- 2026-10-07: Video: [T-133.mp4](../tasks_videos/T-133.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/168
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-133/church-hub-T-133.app (open it with Finder or `open`; port 4233, its own data)

Done. Branch task/T-133, commits f56b825e (change), 97be4462 + 2e0060f6 (e2e tweaks).
- NotificationsSidebarItem.tsx -> NotificationsBell.tsx: an icon-only Link with a red dot while unread (testids sidebar-notifications-bell / -dot), aria-label + title "Notifications"/"Notificări", or "New notifications"/"Notificări noi" (RO from Codex) when unread. Still mounts NotificationPopUp + useRecordAppUpdate.
- sidebar.tsx: Settings and the bell share one row (bell at the right end); stacked under Settings when collapsed; bell alone right-aligned if the user can't see Settings.
- sidebar-item.tsx: removed badgeCount (no other user).
- e2e: new sidebar-notifications-bell.spec.ts (row placement, dot, click opens page + dot gone, collapsed, phone 390px); notifications.spec.ts updated to the bell. Both pass (8/8) on port 3233. Lint clean; tsc errors only in files T-132 owns.
- Not checked: light mode visually (same classes as other sidebar items); the native-window middle-click that SidebarItem offered isn't on the bell (YAGNI).
- Full suite not run yet (after the user's yes).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/168
T-133 Sidebar notifications: just a bell icon with a dot, on the Settings line, to the right
The "Notificări" row is gone: there's now a bell at the right of the Setări row, with a red dot when something is new. Clicking it opens the notifications, as before. It also works when the sidebar is collapsed and on a phone.
- 2026-10-07: User (2026-10-07), requested changes: "i want the notification page to match the design of the other pages.. define a standard and try to be consistent".
=> (1) Look at the app's existing pages and define one page-layout standard (header with title/icon/actions, spacing, content container, empty state, list/card style), as shared components reused by pages, plus a short doc saying what it is and when to use it. (2) Rebuild the Notifications page on it so it looks like the other pages. (3) List the pages that diverge from the standard; the lead files the rest as a follow-up.
- 2026-10-07: Changes done (page layout standard). Video: [T-133.mp4](../tasks_videos/T-133.mp4) (re-made, poster = the page). PR updated: https://github.com/radio-crestin/church-hub/pull/168. app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-133/church-hub-T-133.app (rebuilt).
- Commit e908f5a2: src/ui/page/{Page,PageHeader,PagePanel,EmptyState}.tsx + docs/page-layout.md (the standard, from Songs/Bible/Music: text-2xl title left, actions right, gap-4, full width, content on a bordered rounded-lg panel like the songs list, dashed empty state). NotificationsPage rebuilt on them (was max-w-3xl centred, no panel); NotificationShell cards rounded-xl -> rounded-lg like SongCard.
- e2e: new notifications-page-layout.spec.ts (title x/size = Songs, panel full width, empty state, no sideways scroll at 390px). It plus the bell + notifications specs pass (10/10). Lint clean.
- Pages that diverge from the standard (for the lead to file; from a survey, file:line):
  - Schedules list (routes/schedules/index.tsx:88): space-y-6, no height handling, gray-600 text buttons in Tooltips instead of the indigo/gray pair + ActionMenu.
  - Gallery (features/gallery/components/GalleryPage.tsx:117) and Song key (features/song-key/components/SongKeyPage.tsx:134): full-bleed border-b header bar with their own px-3 sm:px-6 padding (double padding); own empty states (GalleryEmptyState, inline).
  - Song discovery (features/song-discovery/components/SongDiscoveryScreen.tsx:105, DiscoveryHeader.tsx:31): flex-wrap header with a back button, oversized primary button (px-6 py-2.5 text-base), own dashed rounded-xl empty state.
  - Dashboard (routes/dashboard/index.tsx:10): space-y-6, no height handling.
  - Minor: Bible (routes/bible/index.tsx:1540) header gap-3 mb-3 lg:mb-4; Live Stream (LiveStreamPage.tsx:18) and Live Translation (LiveTranslationPage.tsx:165) mb-3 headers and cards with shadow / rounded-xl; Control room (ControlRoom.tsx:140) gap-4 wrapper, gray action buttons in a different size.
  - Empty states hand-written in ScheduleList.tsx:88, SongList.tsx:1072, SceneGrid.tsx:33, and music FolderBrowser.tsx:33 / Playlist.tsx:66 / QueueList.tsx:30 -> EmptyState.
  - Every page repeats the h1 classes by hand (14+ places) -> PageHeader.
  - Settings: ReleaseNotesSection.tsx:31 and the About page copy SettingsSection's card by hand instead of using it.
  - Not checked: schedule editor/presenter, songs/$songId, custom pages.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/168
T-133 Sidebar notifications: just a bell icon with a dot, on the Settings line, to the right
The bell with a red dot is on the Setări row. The Notifications page now looks like the other pages: there is one written standard for pages, with shared building blocks, and the page uses them (title where Songs has it, full width, the list on a panel). The other pages that don't follow it yet are listed to fix separately.
- 2026-10-07: User (2026-10-07), requested changes: "add also a button to mark all notifications as read and also to clean all of them". => On the Notifications page header (per the page standard: actions on the right): "Mark all as read" and "Clear all" (delete every notification, with a confirm step that is not a browser dialog). EN + RO; e2e for both.
- 2026-10-07: Changes done (Mark all as read / Clear all). Video: [T-133.mp4](../tasks_videos/T-133.mp4) (re-made). PR updated: https://github.com/radio-crestin/church-hub/pull/168. app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-133/church-hub-T-133.app (rebuilt).
- Commits 25bb3049, 32c9a5dd. NotificationsPageActions.tsx: two secondary Buttons in the PageHeader actions (icon-only on a phone). Mark all as read: markAllRead + clears the page's "new" highlight; disabled when no listed notification is new. Clear all: ConfirmModal (danger, in-app), then DELETE /api/notifications; disabled when the list is empty.
- Server: deleteAllNotifications(includeSongs) + DELETE /api/notifications, documented in the OpenAPI spec. It removes only what the user sees (without songs.view the song sync's stay, the same rule as GET).
- RO strings from Codex: "Marchează toate ca citite", "Șterge toate", "Ștergi toate notificările?", "Toate notificările vor fi șterse din listă. Acțiunea nu poate fi anulată."
- e2e: new notifications-page-actions.spec.ts (mark all, clear all with cancel + confirm, fails on any browser dialog). All 4 notification specs pass, 12/12. Lint clean; no tsc errors in the touched files.
- A bug my change made, fixed: after Clear all, Mark all stayed enabled (stale ids in the "new" set). Now derived from the listed notifications; covered in the spec.
- Note: opening the page still marks everything read on the server, as in T-120, so in practice the button mostly takes off the highlight shown for notifications that were new on arrival.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/168
T-133 Sidebar notifications: just a bell icon with a dot, on the Settings line, to the right
The bell with a red dot is on the Setări row, and the Notifications page matches the other pages. Its header now has "Marchează toate ca citite" and "Șterge toate"; clearing asks first, inside the app.
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved), with one change on auto-read: "only when clicked". => Opening the Notifications page no longer marks anything as read; a notification becomes read only when the user clicks it (or via "Mark all as read"). The bell dot stays until then.
- 2026-10-07: Finished. Read only when clicked, commit 84037da2. PR ready: https://github.com/radio-crestin/church-hub/pull/168 (mergeable, no GitHub checks). Video: [T-133.mp4](../tasks_videos/T-133.mp4) (re-made). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-133/church-hub-T-133.app (rebuilt).
- Server: POST /api/notifications/:id/read (upsertNotificationRead, idempotent: one already removed is left alone, still 200), in the OpenAPI spec; id decoding shared via decodeId.
- Client: the page no longer auto-marks read. A card is new while readAt is null; a click anywhere on it (links and buttons too) marks it read. Mark all as read is enabled while any listed one is unread. Pop-up: its action (onActed) reads it; closing only dismisses it. The page marks what it lists as seen (local pop-up list) so they don't pop up later. Root cause of the one failing test: without auto-read the previous test left an unread notification that popped up.
- e2e: bell spec (dot stays on opening, card click reads it), notifications.spec (song link click reads it; isolation read before the running-check test), actions spec (+ opening reads nothing / no later pop-up).
- Full suite, serial on port 3233: 813 passed, none flaky or failed (15.4 min). Lint clean. test-results deleted; no Rust target in the worktree (no cargo used).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/168
T-133 Sidebar notifications: just a bell icon with a dot, on the Settings line, to the right
The bell with a red dot is on the Setări row; the Notifications page matches the other pages and has "Marchează toate ca citite" and "Șterge toate". A notification now stays new, and the dot stays on, until you click it (or mark all as read); just opening the page no longer reads them.
- 2026-10-07: Bell icon with a red dot at the right of the Setări row; page-layout standard (docs/page-layout.md, ui/page components) with the Notifications page rebuilt on it; Mark all as read + Clear all (in-app confirm, DELETE /api/notifications); notifications marked read only when clicked. Merged PR #168.
