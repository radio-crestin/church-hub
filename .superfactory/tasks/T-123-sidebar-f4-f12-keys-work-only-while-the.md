---
id: T-123
title: Sidebar F4–F12 keys work only while the app is focused, with an option for system-wide
kind: task
level: normal
order: -14
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T16:25:56.373Z
---

## Goal
User's words (2026-10-06): "the f4-12 must respond only when the app is in focus, not when it's outside.. add an option for this as a config an dby default make it only app level".

Today the sidebar page keys (F4 Present, F5 Songs, F6 Bible, F7 Schedules, F8 Music, F9 Song key, F10 Live translation, F12 Livestream; from T-119) are registered system-wide in the Tauri app, so they fire even when another app is in front. Make them app-level by default (only while a Church Hub window is focused), and add a setting to make them system-wide again. Existing installs get app-level too. Keep F5 presenting on an open song and the presenter-clicker behaviour (presenter-remote.spec) working. Strings in EN and RO. Check other global shortcuts (e.g. MIDI/live) aren't affected unless they're sidebar keys.

## Notes

- 2026-10-06: 2026-10-06: Worktree .claude/worktrees/agent-a04f18f2bbbbbcffc, branch task/T-123, port 3223. Cause: sidebar keys are registered OS-wide whenever useIsAppFrontmost says "in front"; that answer only follows the control window's focus events, so e.g. after focus moves to a projection window and then to another app it stays "in front" and F4–F12 keep firing elsewhere. BEFORE (e2e with a recording fake Tauri shell): shell holds F4,F5,F6,F7,F8,F9,F10,F12 by default (scratchpad/T-123/before2). Plan: app-level (default) = never held OS-wide, the page's own keydown handler (useSidebarShortcutKeys) runs them; new setting sidebarKeysSystemWide = held OS-wide always. Spec: e2e/sidebar-keys-app-level.spec.ts.
- 2026-10-06: Video: [T-123.mp4](../tasks_videos/T-123.mp4)
2026-10-06: Done (draft). PR: https://github.com/radio-crestin/church-hub/pull/162. app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-123/church-hub-T-123.app
Commit 1dd513d4: useGlobalAppShortcuts registers sidebar keys OS-wide only when the new config field sidebarKeysSystemWide is true (then always, not gated on frontmost); otherwise the page's own capture-phase handler (useSidebarShortcutKeys) runs them. New switch in Settings > Shortcuts (ShortcutConfigSwitch, which replaces ShortcutFocusOnlyToggle and serves both switches); EN + RO strings (RO from Codex). Existing installs: field missing = app-level, no migration needed. Checked: new e2e sidebar-keys-app-level.spec.ts (a recording fake Tauri shell shows which keys are held: before F4..F12, after none by default / F4..F12 with the switch), plus songs-f5-shortcut, presenter-remote, bible-search-shortcut, page-scoped-shortcuts, shortcuts-focus-and-permissions, keyboard-shortcuts: 22 passed. Not checked: real OS-wide behaviour in the desktop app on macOS/Windows/Linux (the review app is for that). Trade-off: in app-level mode a sidebar key pressed while a projection window (not the main window) has the keyboard does nothing. Side note for the lead: page-scoped keys and the "only when Church Hub is in front" presentation keys still rely on useIsAppFrontmost, which listens to the main window's focus only, so they can stay held after focus goes main -> projection -> another app. Not changed here.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/162
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-123/church-hub-T-123.app
T-123 Sidebar F4–F12 keys work only while the app is focused, with an option for system-wide
F4 to F12 now open Church Hub pages only while Church Hub is the window you are using, so other programs keep their F-keys. A new switch in Settings > Shortcuts, "Page keys from any program", makes them work from anywhere again. It is off by default.
- 2026-10-06: 2026-10-06: Lead's change done: commit c5a49414. useIsAppFrontmost now re-asks isAppFrontmost() on tauri://focus and tauri://blur from EVERY window (event.listen with no target), not just the main window's onFocusChanged. So page keys and "only when Church Hub is in front" presentation keys are let go when the user leaves for another program from a projection window, and come back when any Church Hub window has the keyboard. MIDI and system-wide keys unchanged. Spec: new test in sidebar-keys-app-level.spec.ts (fake shell moves the keyboard main -> projection -> other program -> main): before the fix F2/F3 stayed held, after it they are released (before3 run in scratchpad). Shortcut specs: 23 passed. Video updated with the projection scene, review app rebuilt, PR updated. Not checked: real desktop app on each OS. Linux note: isAppFrontmost asks window.isFocused(), which the code says is always false on Linux, so there a projection holding the keyboard counts as "not in front" and these keys are let go. That is the safe side, and it was already so before.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/162
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-123/church-hub-T-123.app
T-123 Sidebar F4–F12 keys work only while the app is focused, with an option for system-wide
F4 to F12 now open Church Hub pages only while Church Hub is the window you are using. A new switch in Settings > Shortcuts, "Page keys from any program", makes them work from anywhere; it is off by default. Keys set to work "only when Church Hub is in front" now also stop as soon as you switch to another program, even from a projection window.
- 2026-10-06: User (2026-10-06), requested changes: "make it for each shortcut as the user might want some shortcuts to be system keys..". => Replace the single "Page keys from any program" switch with a per-shortcut choice (app-only vs system-wide) for each shortcut; default app-only for the sidebar F-keys; existing per-shortcut behaviour preserved where already system-wide.
- 2026-10-06: 2026-10-06: Per-key change done: commit e1933edf (on top of 1dd513d4 and the focus fix c5a49414). Every keyboard key in the shortcut settings gets its own switch next to it, "Church Hub only" / "Any program" (ShortcutScopeToggle inside ShortcutRecorder via scopeKind). It is stored per key in global_keyboard_shortcuts.keyScopes, and shortcutScope() matches any spelling of a key. Defaults: sidebar and page keys app, presentation/livestream actions and OBS scenes system. Registration (useGlobalAppShortcuts): a system key is always held; an app key is held only while frontmost; app sidebar keys are never held, the page runs them. Both all-at-once switches are removed (sidebarKeysSystemWide, and onlyWhenAppFocused from T-041). Server migration move-focus-only-to-key-scopes.ts turns onlyWhenAppFocused=true into app scope for every action and scene key, then drops the field (tried on sample DBs: true/false/absent, and running it twice). SceneSettingsPopup (livestream area) only gets scopeKind="scene". Specs: sidebar-keys-app-level renamed to shortcut-scopes.spec.ts (per-key switch saved and followed in both of Songs' F5 lists, defaults, system sidebar key held with another program in front, the projection case with F1 system and F2/F3 app); shortcuts-focus-and-permissions renamed to shortcuts-permissions.spec.ts (its switch test removed). Run: shortcut-scopes, shortcuts-permissions, sidebar-config, songs-f5-shortcut, presenter-remote, bible-search-shortcut, page-scoped-shortcuts, keyboard-shortcuts all pass. New video, review app rebuilt, PR updated. Not checked: the real desktop app on each OS.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/162
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-123/church-hub-T-123.app
T-123 Sidebar F4–F12 keys work only while the app is focused, with an option for system-wide
Every shortcut now has its own switch: "Church Hub only" or "Any program". Sidebar keys F4 to F12 start as Church Hub only, so other programs keep their F-keys; presentation and live stream keys still work from any program. Church Hub only keys also stop as soon as you switch to another program, even from a projection window.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Accepted. Full suite (CI=1 TEST_PORT=3223, --workers=1 --retries=2): 780 passed, 34 skipped, 0 failed (13.6 min). PR #162 marked ready (open, mergeable, not draft).
- 2026-10-06: Every shortcut has its own "Church Hub only / Any program" switch; F4–F12 default to Church Hub only; focus check follows every Church Hub window; old all-at-once switches removed with a migration. Merged PR #162.
