---
id: T-012
title: F5/F6 focus the Bible search box
sprint: 2026-09-28
urgent: false
status: done
owner: bible
rolled: 0
order: -5
created: 2026-10-04
---
## Goal
Chat 28/06 BCEV: «Add shortcut F5 when is on Bible to make the focus on search input»; 04/10 BCEV: «cand apas F6 nu se face focus pe input-ul de search din pagina cu Biblia» (still broken today). The focus-search shortcut is configurable (GlobalAppShortcutManager.tsx 147-165, BibleNavigationPanel focusTrigger); F5 now means "show selected slide". Make the Bible sidebar shortcut (F6) reliably focus and select the search input, with an e2e test.

## PR
- Branch: fix/bible-shortcut-focus-search
- PR: #78 https://github.com/radio-crestin/church-hub/pull/78
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/before-F6-focuses-the-Bible-search.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/after-F6-focuses-the-Bible-search.mp4

## Notes
- 2026-10-04: (bible) PR — branch fix/bible-shortcut-focus-search, PR #78 https://github.com/radio-crestin/church-hub/pull/78 ; videos before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/before-F6-focuses-the-Bible-search.mp4 after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/after-F6-focuses-the-Bible-search.mp4 . Root causes: (1) BibleNavigationPanel only called focus(); with the box already focused (right after search + Enter) onFocus never ran, text stayed unselected, next reference glued on ("Ioan 3:16Gen 1:1"). (2) Sidebar shortcuts existed only as Tauri OS-wide hotkeys (held only while frontmost, never in a browser); a press reaching the page was unhandled → browser default (F6 = address bar). Fix: ea584ef8 select() after focus(); d4329eea new useSidebarShortcutKeys (capture keydown, only configured sidebar keys, skips MIDI/recording/repeat) mounted in GlobalAppShortcutManager; 4ceb5e03 e2e bible-search-shortcut.spec.ts (3 tests; first fails on main). Clash check: only keys bound to sidebar items are touched; F5 path unchanged. Test: CI=1 TEST_PORT=3112 bunx playwright test e2e/bible-search-shortcut.spec.ts --workers=1 --retries=2; regression bible/keyboard-shortcuts/page-scoped-shortcuts/sidebar-config 31 passed. Not verified: desktop shell (macOS/Windows) — OS-wide hotkey should consume the key so no double fire; even if both ran it is idempotent. Branch rebased onto origin/main (local main has 9 unpushed task/worktree commits). Could not edit the task file's ## PR section: the worktree guard blocks writes to the main-checkout path.
- 2026-10-04: (bible) Videos re-recorded with red boxes/arrows marking bug (before, recorded on origin/main code) and fix (after). Branch rebased on origin/main 0e09e9c0; commits now cc612c81, f5bf40a8, bf8119cc; PR #78 body updated. New videos — before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/before-F6-focuses-the-Bible-search.mp4 after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/after-F6-focuses-the-Bible-search.mp4 . bible-search-shortcut.spec.ts 4/4 (incl. setup) after rebase.
- 2026-10-04: (bible) New PR lines (v3, voice-over + red highlights; supersede v2): branch fix/bible-shortcut-focus-search, PR #78 https://github.com/radio-crestin/church-hub/pull/78 ; videos before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/before-F6-focuses-the-Bible-search.mp4 after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-bible-shortcut-focus-search-v3/after-F6-focuses-the-Bible-search.mp4 . Rebased on origin/main 0247de61; commits now 154f6ec1, 90a505ea, 40640674 (one force-push). Before recorded on main code, after on branch; captions in full words, read aloud (5 voice clips each; GIFs silent). bible-search-shortcut.spec.ts passes after rebase. PR body updated.
- 2026-10-04: F6 focuses and selects the Bible search text; sidebar shortcut keys now also handled in the page (browser). PR #78 (not merged yet).
