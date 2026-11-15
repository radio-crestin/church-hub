---
id: T-117
title: "Lint: fix the 17 errors `bun run lint` reports on main"
kind: task
level: normal
order: -12
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T15:35:53.388Z
---

## Goal
Found by the T-110 teammate (2026-10-06): `bun run lint` in app/ reports 17 errors on main, in files T-110 doesn't touch. Fix them at the root so lint is clean on main.

## Notes

- 2026-10-06: 2026-10-06: Fixed all lint errors outside T-120's files; draft PR #160 (branch task/T-117). Remaining: song-discovery.spec.ts (format/imports) and LyricsDiffView.tsx (stale suppression), owned by song-sources-2. No UI change, so no video.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Accepted. Full suite: 777 passed, 34 skipped, 0 failed. PR #160 marked ready.
- 2026-10-06: Lint clean on main (formatting/imports, unused var, dead LibreOffice server file, stale suppression). Merged PR #160.
