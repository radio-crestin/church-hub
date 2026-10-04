---
id: T-012
title: F5/F6 focus the Bible search box
sprint: 2026-09-28
urgent: true
status: doing
owner: bible
rolled: 0
order: -5
created: 2026-10-04
---
## Goal
Chat 28/06 BCEV: «Add shortcut F5 when is on Bible to make the focus on search input»; 04/10 BCEV: «cand apas F6 nu se face focus pe input-ul de search din pagina cu Biblia» (still broken today). The focus-search shortcut is configurable (GlobalAppShortcutManager.tsx 147-165, BibleNavigationPanel focusTrigger); F5 now means "show selected slide". Make the Bible sidebar shortcut (F6) reliably focus and select the search input, with an e2e test.

## Notes
- 2026-10-04: (bible) PR — branch fix/bible-shortcut-focus-search, PR #78 https://github.com/radio-crestin/church-hub/pull/78 ; videos before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search/before-F6-focuses-the-Bible-search.mp4 after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search/after-F6-focuses-the-Bible-search.mp4 . Root causes: (1) BibleNavigationPanel only called focus(); with the box already focused (right after search + Enter) onFocus never ran, text stayed unselected, next reference glued on ("Ioan 3:16Gen 1:1"). (2) Sidebar shortcuts existed only as Tauri OS-wide hotkeys (held only while frontmost, never in a browser); a press reaching the page was unhandled → browser default (F6 = address bar). Fix: ea584ef8 select() after focus(); d4329eea new useSidebarShortcutKeys (capture keydown, only configured sidebar keys, skips MIDI/recording/repeat) mounted in GlobalAppShortcutManager; 4ceb5e03 e2e bible-search-shortcut.spec.ts (3 tests; first fails on main). Clash check: only keys bound to sidebar items are touched; F5 path unchanged. Test: CI=1 TEST_PORT=3112 bunx playwright test e2e/bible-search-shortcut.spec.ts --workers=1 --retries=2; regression bible/keyboard-shortcuts/page-scoped-shortcuts/sidebar-config 31 passed. Not verified: desktop shell (macOS/Windows) — OS-wide hotkey should consume the key so no double fire; even if both ran it is idempotent. Branch rebased onto origin/main (local main has 9 unpushed task/worktree commits). Could not edit the task file's ## PR section: the worktree guard blocks writes to the main-checkout path.
