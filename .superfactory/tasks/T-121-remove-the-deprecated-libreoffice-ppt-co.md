---
id: T-121
title: Remove the deprecated LibreOffice PPT conversion left in the client
kind: task
level: normal
order: -13
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T15:49:21.257Z
---

## Goal
Found by the T-117 teammate (2026-10-06): app/apps/client/src/features/song-import/utils/convertPptToPptx.ts still has `convertPptToPptx` and `checkLibreOfficeInstalled`, marked deprecated. LibreOffice was replaced by a pure-JS PPT parser (commit f214246b). The project rule is to remove, not deprecate: delete them and refactor any callers, keeping PPT import working (cover with the existing import e2e).

## Notes

- 2026-10-06: 2026-10-06: Draft PR #161 (task/T-121). Removed the 3 dead exports from convertPptToPptx.ts only. PR #159 edits its importers and server index.ts, so the file rename and the removal of the check-libreoffice endpoint wait until #159 merges. file-drop-import.spec.ts 3/3 pass; lint and tsc clean.
- 2026-10-06: User (2026-10-06): asked whether .pptx and .ppt both still work and why LibreOffice was used; answered (LibreOffice converted binary .ppt; replaced by ppt-to-text in f214246b; file-drop-import.spec covers both). Then accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Accepted. Full suite: 777 passed, 34 skipped, 0 failed. PR #161 marked ready.
- 2026-10-06: Removed the unused LibreOffice conversion (convertPptToPptx, checkLibreOfficeInstalled, LibreOfficeNotInstalledError) from the client; .pptx and .ppt import unchanged. Merged PR #161. Endpoint removal + rename follow in T-122.
