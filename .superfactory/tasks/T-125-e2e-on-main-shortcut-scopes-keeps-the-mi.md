---
id: T-125
title: "e2e on main: shortcut-scopes keeps the MIDI note-40 key held after leaving a projection"
kind: task
level: normal
order: -12
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T19:58:22.535Z
---

## Goal
Found by the T-120 teammate (2026-10-06) on plain origin/main 1d8a585f: shortcut-scopes.spec.ts:252 "Church Hub only keys are let go…" fails: the held keys still include "midi:note_on:40" after leaving a projection. Spec from T-123 (#162), which passed its full suite on its branch, so a later merge or the test data may interact. Repro: check out origin/main, build the client for your port, `CI=1 TEST_PORT=<port> bunx playwright test shortcut-scopes.spec.ts --workers=1 --retries=0`. Log: /private/tmp/claude-501/-Users-iosif-Documents-Projects-church-hub/9474d1e1-01f2-42a5-9c21-080e52e9f21a/scratchpad/T-120/v3/fail3-main.log. Find the root cause (app or test) and fix it; MIDI keys should not be in the "held" set the spec checks, or the spec's expectation is wrong; decide from the code.

## Notes

- 2026-10-06: 2026-10-06: Worktree agent-a922c7cb22e06730a, branch task/T-125, port 3225. Cause (app): useGlobalAppShortcuts passed MIDI bindings (midi:note_on:40 on Start live) to the OS global-shortcut plugin like keyboard keys; actions default to "any program", so it stayed held after leaving. Fresh DB has no MIDI binding, so the spec passed on T-123's branch; T-120's DB had one. BEFORE: spec seeded with a MIDI pad on Start live fails the same way (scratchpad/T-125/before.log). Fix c1e7143a: isHeld skips MIDI bindings; isMidiShortcut util shared with the two existing inline checks. After: 8 shortcut specs, 30 passed.
- 2026-10-06: Video: [T-125.mp4](../tasks_videos/T-125.mp4)
2026-10-06: Done (draft). PR: https://github.com/radio-crestin/church-hub/pull/163. app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-125/church-hub-T-125.app
Commit c1e7143a: root cause was in the app, not the spec. useGlobalAppShortcuts asked the OS global-shortcut plugin to hold MIDI bindings (midi:note_on:40) like keyboard keys; actions default to "any program", so it was held even with another program in front. isHeld now skips MIDI bindings; new isMidiShortcut util also replaces the inline 'midi:' checks in useSidebarShortcutKeys and usePageShortcuts. The spec seeds a MIDI pad on Start live so the case is always covered (fresh DBs have none, which is why it passed on T-123's branch). Checked: before 1 failed / after 5 passed in shortcut-scopes; shortcut-scopes, shortcuts-permissions, sidebar-config, songs-f5-shortcut, presenter-remote, bible-search-shortcut, page-scoped-shortcuts, keyboard-shortcuts: 30 passed, 2 skipped. Lint clean on changed files (main has unrelated lint errors in song-discovery: LyricsDiffView.tsx:64 unused suppression, song-discovery.spec.ts format/imports). Not checked: a real MIDI pad in the desktop app (MIDI is dispatched server-side, untouched).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/163
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-125/church-hub-T-125.app
T-125 e2e on main: shortcut-scopes keeps the MIDI note-40 key held after leaving a projection
A MIDI pad button set as a shortcut was wrongly also treated as a keyboard key by the desktop app. Now only real keys are held; MIDI buttons keep working through the MIDI listener as before, and the failing test passes.
- 2026-10-06: User (2026-10-06): "midi pad should work alongisde any other shortcut and they will be always global..". => MIDI pad bindings always work, whether or not Church Hub is in front (never limited by "Church Hub only"), and alongside keyboard shortcuts for the same action. Verify the MIDI listener fires regardless of focus/scope (incl. projection window or another app in front), that no scope switch applies to MIDI, and cover it in the spec.
- 2026-10-06: 2026-10-06: User's change done: commit 677cdabe. MIDI pads always work globally. Client: useGlobalAppShortcuts never gives a pad to the keyboard shell or a scope (it now uses the existing isMIDIShortcut from midi/utils; my duplicate util is removed). Server: the MIDI listener (service/midi/shortcuts.ts, handleMIDIShortcut) has no window/focus input and ignores keyScopes, so a pad fires whatever program is in front, and no scope can limit it. No server change needed. An action can have both a key and a pad: the key follows its scope, the pad always works. New spec case in shortcut-scopes.spec.ts: Next slide on F2 (app) plus midi:note_on:41 with a stored app scope. Before: the shell held the pad (["F2","midi:note_on:41","F1"], scratchpad/T-125/before3.log). After: the pad is never held, F2 is let go with another program in front, and /api/midi/debug-shortcuts maps the pad to nextSlide throughout. Run: shortcut-scopes 6 passed; shortcut + MIDI specs (incl. midi-startup) 33 passed, 2 skipped. New video, PR updated, review app rebuilt. Not checked: pressing a real MIDI pad (no device here).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/163
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-125/church-hub-T-125.app
T-125 e2e on main: shortcut-scopes keeps the MIDI note-40 key held after leaving a projection
MIDI pad buttons now always work, from any program, and the "Church Hub only" switch never applies to them. An action can have both a key and a pad: the key follows its own switch, and the pad works everywhere.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Accepted. Full suite (CI=1 TEST_PORT=3225, --workers=1 --retries=2): 781 passed, 34 skipped, 0 failed (14.6 min). PR #163 marked ready (open, mergeable, no checks).
- 2026-10-06: MIDI pads are never held as OS keyboard keys and never scoped: they always work from any program, alongside each action's keyboard key. Merged PR #163.
