---
id: T-035
title: One Resurse Crestine importer with a review mode and a stable download link
sprint: backlog
urgent: false
status: todo
owner:
rolled: 0
order: 32
created: 2026-10-04
---
## Goal
Chat 06/09 Iosif: «va trebui sa decidem daca eliminam una din cele 2 versiuni de descarcare cantari de pe resurse crestine (acum avem 2 mecanisme separate care fac acelasi lucru..)» + «eventual putem adauga un buton, in cazul in care utilizatorul vrea sa autorizeze fiecare modificare sa o poata face..»; 30/08 BCEV: «apare aceasta eroare in modulul de descarcare din Resurse Crestine» / «probabil ca da 403 forbidden»; 17/09 BCEV: «am observat ca a aparut 403 la update-ul de cantari». User 04/10: one importer (the fast bulk update that skips user-edited songs) plus an optional "review each change" mode reusing the Discover approval UI; remove the duplicate path (ImportExportManager.tsx vs song-discovery/providers/resurseCrestine.ts). Download from https://www.resursecrestine.ro/download/52651 (redirects to the opensong-standard ZIP; 206 OK on 04/10), fallback https://www.resursecrestine.ro/download/65147 (proiectie); show the real HTTP status instead of the generic error.

## Notes
