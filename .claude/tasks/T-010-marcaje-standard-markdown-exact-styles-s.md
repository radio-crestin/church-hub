---
id: T-010
title: Marcaje standard Markdown — exact styles, same export/import, per-screen rendering
sprint: 2026-10-05
urgent: false
status: todo
owner:
rolled: 0
order: 4
created: 2026-10-04
---
## Goal
Chat 16/08 BCEV: «ar fi utila o sectiune de bookmarks si pentru versete in care sa se memoreze inclusiv anotarile pe fiecare slide» + «deasemenea sa existe butoane de import/export ca si markdown/json»; 27/09 BCEV: «marcajele nu exporta si anotarile (sublinierile, etc.)», «in marcajele versetelor, sublinierea nu este salvata si afisata corect», «rendering-ul sublinierii nu e perfecta pe videoproiector»; 30/08 Iosif: «export-ul pare sa aiba propriul lui format.. nu este export-ul ca in programe (nu are id-ul cantarii, samd)». User 04/10: store marked songs/Bible verses as Markdown with the exact bold/underline/highlighted words; export/import that same format (with song id); every screen renders it independently and underline renders correctly from the Markdown; standardise. Today: styleRanges stored, export plain text without styles (bible-bookmarks/exportBookmarks.ts, song-bookmarks/exportBookmarks.ts).

## Notes
