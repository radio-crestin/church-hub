---
id: T-122
title: Remove the unused check-libreoffice endpoint and rename convertPptToPptx.ts to parsePptViaServer.ts
kind: task
level: normal
order: -16
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T20:59:29.210Z
---

## Goal
Follow-up of T-121 (found 2026-10-06): after T-121, GET /api/convert/check-libreoffice has no caller. Remove it (server/src/index.ts, openapi/paths/conversion.ts, its test in api-comprehensive.spec.ts) and rename app/apps/client/src/features/song-import/utils/convertPptToPptx.ts to parsePptViaServer.ts, updating its importers. Start only after T-120's PR #159 is merged, since #159 edits those files.

## Notes

- 2026-10-06: 2026-10-06: done on task/T-122, draft PR #166. Removed check-libreoffice endpoint + OpenAPI + test, renamed to parsePptViaServer.ts (5 importers), dropped orphaned libreOfficeNotInstalled i18n keys. Lint clean; 3 related specs 61 passed. No user-visible change, no video. Full suite pending the user's yes.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: accepted. Full suite: 803 passed, 2 flaky (passed on retry), 34 skipped. PR #166 marked ready. cargo clean + test-results removed.
- 2026-10-06: Removed GET /api/convert/check-libreoffice (server, OpenAPI, test) and two unused strings; convertPptToPptx.ts renamed parsePptViaServer.ts. Merged PR #166.
