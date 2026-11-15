---
id: T-111
title: "Dev app on this PC: use the default fixtures, not the bad fonts"
kind: task
level: normal
order: -4
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T14:27:52.534Z
---

## Goal
User's words (2026-10-06, running the dev app from main in the main checkout, port 3001): "also, make sure that on our pc, you use the default fixtures.. as i see some bad fonts here".

Their screenshot: the Bible preview (Judecatori 9:17, "Căci tatăl meu s-a luptat pentru voi; şi-a pus viaţa în primejdie şi v-a izbăvit din mâna lui Madian;") renders in a plain serif font (Times-like), white on black, centered, under "Anterior / Următor" buttons — not the app's default slide design.

Find why the dev data on this machine shows these fonts (stale or e2e fixtures in the dev database, a missing font, a fallback), and make the dev app here use the default fixtures and default slide designs. Do not wipe the user's own data without asking: back it up first and say what would change. Never kill or restart ports 3000/3001; ask the lead for a restart.

## Notes

- 2026-10-06: Cause: the dev DB (main checkout app/data/app.db) was seeded on 2026-06-03 from the old fixture (Times New Roman for Bible/song text, system-ui elsewhere). T-091's factory design (Fira Sans/Montserrat) only applies to new screens and fresh installs, so existing screens keep the old look. None of the 28 designs were edited after the seed (updated_at = seed date), so a reset loses nothing custom. Plan: back up app.db, then use the running server's PUT /api/screens/:id/batch-config to set each screen to the factory design. Songs, programs, settings and Bibles stay as they are. No server restart needed.
- 2026-10-06: Done on this PC (data only, no code change, no PR). Backup: /Users/iosif/Documents/Projects/church-hub/app/data/backups-t111/app-before-T-111.db (integrity ok, gitignored). Wrote the factory design into the dev DB for all 4 screens (Main, Stage, Live Stream, Kiosk): global settings, the 7 stored content configs each, next-slide style (on/off kept as it was). Songs, programs, settings, Bibles untouched; no restart. Before/after: scratchpad t111/before-screen26.png (Times New Roman, centred) -> after-screen26.png (Fira Sans text, gold Montserrat reference). Open app windows need a reload (Cmd+R) to pick it up, since a direct DB write doesn't broadcast. Undo: stop the dev server and copy the backup over app/data/app.db (lead/user only).
- 2026-10-06: User (2026-10-06), asked if T-111 is OK: "i've already requested some changes", meaning the follow-ups filed as T-112 (transitions), T-113 (open-source hymns), T-114 (e2e content out of fixtures), T-115 (livestream defaults + guide). Close T-111 when those land.
- 2026-10-06: Dev DB screens reset to the factory design (backup app/data/backups-t111/); the user's follow-up changes landed as T-112, T-113, T-114, T-115. Data-only, no PR.
