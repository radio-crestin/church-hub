---
id: T-137
title: "e2e: page-scoped-shortcuts.spec.ts:54 is flaky"
kind: task
level: normal
order: -3
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-07T00:00:00.000Z
updatedAt: 2026-10-07T10:58:08.104Z
---

## Goal
Found by the T-136 teammate (2026-10-07): in the full serial suite, page-scoped-shortcuts.spec.ts:54 failed once and passed on retry; unrelated to T-136. Find the root cause (test timing, leftover state from an earlier spec, or a real shortcut race a user could hit) and fix it.

## Notes

- 2026-10-07: Video: [T-137.mp4](../tasks_videos/T-137.mp4)
2026-10-07: PR: https://github.com/radio-crestin/church-hub/pull/176 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-137/church-hub-T-137.app. A real race in PageShortcutsSettings: a config refetch reloaded a page's lists and wiped a just-added empty slot when that page had not saved yet. Fix: reload only when the page's own settings changed. The :54 test failed 4/25 before the fix and passed 25/25 after. No new e2e: a forced-order test also passed on the old code, so I dropped it. Full suite: 831 passed, 1 flaky (bookmark-drag, which T-136 fixes and which is not merged yet).
- 2026-10-07: User (2026-10-07): accepted (Mark as resolved).
- 2026-10-07: Settings › Shortcuts: each page's section reloads only when its own settings change, so a just-added key slot is no longer wiped by another page's save. Merged PR #176.
