---
id: T-095
title: One generic notification system — shown at the top (a bit lower), nicely spaced, easy to see
kind: task
level: normal
urgent: true
order: -2
status: cancelled
progress: 0
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T18:54:15.266Z
---

## Goal
User (2026-10-05): «move all the notification to top but a bit lower... , your sound is off and so on.. nicely spaced, easy to see..».

Done means:
- Every in-app notification — toasts and status banners like "your sound is off" and the others like it — appears at the top of the window, a bit below the very top edge (not glued to it, not covering the app's header/controls), centred or consistently placed.
- When several show at once, they stack with even spacing and don't overlap each other or important controls.
- Easy to see and read: clear contrast, readable size, icon + short text, in light and dark themes; works at phone width.
- One shared placement/style for all of them (one place in the code), not per-notification tweaks.
- e2e spec checks position and stacking; before/after 1080p video.

## Notes

- 2026-10-05: User 2026-10-05: «define like a generic system to create the notifications..». So the task now also includes one generic notification system for the whole app: a single API (e.g. notify({ kind: info|success|warning|error, title, message, action?, persistent?, id? }) plus dismiss/update by id) and one host component that owns placement, stacking, spacing, timing and styling. Persistent status banners (e.g. "your sound is off") use the same system: they stay while the condition lasts and go away when it's fixed, deduplicated by id. Move every existing notification/toast/banner onto it and remove the old ad-hoc ones (no two systems). Texts stay in i18n (en + ro). Document the API in one short place (a comment at the top of the API file).
- 2026-10-05: User answers 2026-10-05: "your sound is off" was meant for another project — don't add it; just move every existing message (showToast calls, kiosk "Connection lost" chip) onto the new system. The "update available" card stays in the sidebar. Feedback tool bars and the startup loading screen are not notifications: leave them.
- 2026-10-05: Done (awaiting CI). Changed: one notification system in app/apps/client/src/ui/notifications/ (replaces ui/toast/): notify({kind,title,message,action,persistent,id,duration,dismissible}), dismiss(id), showToast shorthand, useNotificationWhile(condition, opts) for status banners; API documented at top of useNotifications.ts. NotificationHost = only placement: top centre, 4rem below top (4.75rem on phones, under the header), 12px gaps, max 30rem wide, 16px gutters. Card: icon + coloured edge per kind, light/dark. All 56 useToast callers migrated; provider moved inside ThemeProvider in both layouts; kiosk "Connection lost" chip (bottom-left) now a persistent warning via useKioskDisconnectionNotice. Not changed (agreed): Request-a-feature tool bars, sidebar update card, loading screen; no "sound is off" (other project). Test: upload 3 .txt files on /gallery → 3 cards top centre; e2e/notifications.spec.ts + src/ui/__tests__/Notifications.test.tsx; full unit suite 1419 pass; gallery+notifications e2e pass. Commits: 9d53a1c0, 27a25337. Not verified: kiosk banner on a real kiosk device (covered by unit test of useNotificationWhile only).
PR: https://github.com/radio-crestin/church-hub/pull/130
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-aef5fdb37e1e4e7e3/.review-build/T-095/church-hub-T-095.app
- 2026-10-05: Video: [T-095.mp4](../tasks_videos/T-095.mp4) (poster: ../tasks_videos/T-095.png). I can't edit the task file from my worktree, so please move this line to the top of ## Notes.
- 2026-10-05: CI all green. Test (full e2e, dispatched): https://github.com/radio-crestin/church-hub/actions/runs/37355064983 ; builds/CodeQL/gitleaks green on PR #130.
build: https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-macos-arm64-pr-130-27a2533.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-windows-x64-pr-130-27a2533.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-linux-x64-pr-130-27a2533.AppImage
- 2026-10-05: User reviewed and said «no, keep the old way» → "Drop it all" (2026-10-05). PR #130 closed without merging; messages stay bottom-right as before. The work is kept on the remote branch feat/notification-system if ever wanted.
