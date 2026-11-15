---
id: T-035
title: One Resurse Crestine importer with a review mode and a stable download link
kind: task
level: normal
order: 32
status: backlog
progress: 0
createdAt: 2026-10-04T00:00:00.000Z
updatedAt: 2026-10-04T11:08:02.591Z
---

## Goal
Chat 06/09 Iosif: «va trebui sa decidem daca eliminam una din cele 2 versiuni de descarcare cantari de pe resurse crestine (acum avem 2 mecanisme separate care fac acelasi lucru..)» + «eventual putem adauga un buton, in cazul in care utilizatorul vrea sa autorizeze fiecare modificare sa o poata face..»; 30/08 BCEV: «apare aceasta eroare in modulul de descarcare din Resurse Crestine» / «probabil ca da 403 forbidden»; 17/09 BCEV: «am observat ca a aparut 403 la update-ul de cantari». User 04/10: one importer (the fast bulk update that skips user-edited songs) plus an optional "review each change" mode reusing the Discover approval UI; remove the duplicate path (ImportExportManager.tsx vs song-discovery/providers/resurseCrestine.ts). Download from https://www.resursecrestine.ro/download/52651 (redirects to the opensong-standard ZIP; 206 OK on 04/10), fallback https://www.resursecrestine.ro/download/65147 (proiectie); show the real HTTP status instead of the generic error.
