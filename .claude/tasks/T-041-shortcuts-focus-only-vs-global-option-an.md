---
id: T-041
title: Shortcuts: focus-only vs global option, and respect permissions
sprint: backlog
urgent: false
status: todo
owner:
rolled: 0
order: 38
created: 2026-10-04
---
## Goal
Chat 07/06 Bogdan: «când e deschisă altă aplicație, de exemplu, BibleShow, comenzile tip F1..F12, sunt captate de program, chiar dacă e minimizat...»; Iosif: «ar trebui facut optional acest behaviour sa poti selecta daca vrei cu focus in aplicatie sau nu»; Bogdan: «când un user nu are permisiunea de a vizualiza, de exemplu youtube, comenzile rapide ... să nu meargă». Navigation shortcuts are already frontmost-only; presentation/scene/OBS shortcuts are always global with no setting; useSidebarItemShortcuts.ts has no permission filter. Add the setting and the permission filter.

## Notes
