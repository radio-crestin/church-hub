---
id: T-012
title: F5/F6 focus the Bible search box
sprint: backlog
urgent: false
status: todo
owner:
rolled: 0
order: 9
created: 2026-10-04
---
## Goal
Chat 28/06 BCEV: «Add shortcut F5 when is on Bible to make the focus on search input»; 04/10 BCEV: «cand apas F6 nu se face focus pe input-ul de search din pagina cu Biblia» (still broken today). The focus-search shortcut is configurable (GlobalAppShortcutManager.tsx 147-165, BibleNavigationPanel focusTrigger); F5 now means "show selected slide". Make the Bible sidebar shortcut (F6) reliably focus and select the search input, with an e2e test.

## Notes
