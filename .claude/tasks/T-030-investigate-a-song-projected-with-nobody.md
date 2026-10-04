---
id: T-030
title: Investigate a song projected with nobody presenting it
sprint: 2026-09-28
urgent: false
status: done
owner: projector
rolled: 0
order: 0
created: 2026-10-04
---
## Goal
Chat 07/09 Bogdan: «Ceva straniu se întâmplă de la ultima versiune, apar slide-uri precum cineva în remote proiectează și pune versete biblice.» + «A apărut acuma proiectat cantarea Slava Ta» + «Fără să fi făcut eu nimic» (video 00003177-VIDEO-2026-09-07-12-27-51.mp4 in ~/Downloads/WhatsApp Chat - Church Hub Bugs). Suspects: v0.1.96 program-row projection (10a83db0), shortcuts/focus changes (3657b824), remote/sync clients. Find the root cause.

## Notes
- 2026-10-04 Root cause found. The slides in Bogdan's video ("Slide 1"/"Urmează Slide 2", "Slide B", "Third slide" + "AMIN") are e2e fixtures; VS Code with test output sat on the next monitor. `playwright.config.ts` defaulted `TEST_PORT` to 3000 (the desktop app's port) with `reuseExistingServer: !isCI`, so a local `playwright test` drove the live app: its projector and its real DB (the test DB only applies to a server Playwright starts). Reproduced (before video). Local mode also ran `dev:web`, whose `free-port.js 3000` kills the app.
- Fix (`1a27d2ea`): default port 3099, `reuseExistingServer: false` (stops with "is already used"), local runs build + serve the client like CI. Guard spec `e2e/test-server-isolation.spec.ts`.
- Test: `CI=1 TEST_PORT=3130 bunx playwright test e2e/test-server-isolation.spec.ts --workers=1 --retries=2` passes; local run with no env passes on 3099 (also cold, no dist).
- Not verified: CI job on 3099; "Slava Ta" itself (likely a test projecting an existing song from his DB). Follow-up for the user: Bogdan's DB may hold leftover e2e data ("E2E …" songs, screen/settings edits). teammate.md line "without CI=1 Playwright starts dev:web" is now stale.
- 2026-10-04: Root cause: local e2e runs reused the running app on port 3000 and drove its real projector/DB (the stray slides are e2e fixtures). Fix: e2e on its own port 3099, never reuses a server, no dev:web. PR #74. Follow-up: teammate.md line about CI=1/dev:web becomes stale once #74 merges; Bogdan's DB may hold leftover e2e songs.

## PR
- Branch: fix/stray-projection
- PR: #74 https://github.com/radio-crestin/church-hub/pull/74
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-stray-projection/T-030-before.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-stray-projection/T-030-after.mp4
