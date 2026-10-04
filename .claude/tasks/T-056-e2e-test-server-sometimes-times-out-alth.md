---
id: T-056
title: E2E test server sometimes "times out" although it started
sprint: 2026-09-28
urgent: false
status: done
owner: panel-layout
rolled: 0
order: -14
created: 2026-10-04
---
## Goal
Reported twice on 2026-10-04 (projector teammate, songs-search teammate): a local e2e run fails before any test — Playwright times out waiting for its own test server, while the server log says it was ready; a rerun passes. Possibly linked to the new e2e server config from PR #74 (own port 3099 / per-worktree TEST_PORT, reuseExistingServer off, built client served instead of dev:web). Find the root cause (e.g. readiness URL/host 127.0.0.1 vs localhost/IPv6, wrong port probed, slow build counted in the timeout) and fix it so a cold and a warm run start reliably. No timeout bump as the fix.

## Notes
- 2026-10-04: Done, awaiting review.
Cause: Playwright's webServer readiness probe (GET <url>), and its "port already used" pre-check, has no socket timeout in 1.59. One request that never gets an answer stalls the start until the 180 s deadline, however early the server is Ready. Matches both reports: Ready in about 0.2 s, rerun passes, other e2e running.
Ruled out the server: GET / during start-up always answered in under 1 ms, and the boot-to-real handoff never left a connection hanging (more than 1,100 connections x 5).
The exact stuck request from those runs was not reproduced.
Reproduced a second hazard: with a stray non-answering listener on the port, the old config waited 12 s, then the server's lsof-based port cleanup SIGKILLed the Playwright runner itself (exit 137). New config: passes in 2 s.
Fix (commit 4762f943): playwright.config.ts waits for "[startup] === Server Ready" on stdout (webServer.wait) instead of url. No probe and no pre-check. TEST_PORT=3000 throws. test-server-isolation.spec.ts guards it.
Verified locally: cold start, 10 warm starts under CPU load, the stray listener, and 4 specs at --workers=1 --retries=2 (20 passed, 1 skipped). CI e2e is running: https://github.com/radio-crestin/church-hub/actions/runs/37217636555
Separate finding, out of my area: under load the server sometimes crashes in CoreMIDI init ("MidiInCore::initialize ... (-304)", Bun panic). It hit 2 of 10 loaded runs and fails fast ("not able to start"), not a timeout.
PR lines: branch: fix/e2e-server-startup; pr: #85 https://github.com/radio-crestin/church-hub/pull/85; after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-e2e-server-startup/T-056-after.mp4 (after video only: no user-visible change). PR builds: https://github.com/radio-crestin/church-hub/actions/runs/37217602514
Note: my worktree now has the T-056 branch checked out. The T-055 branch is pushed.
- 2026-10-04: Rebased on main (8e6e23eb). The fix is now eb576e92, force-pushed once. The video was re-uploaded with the new upload-demos.sh, and the GIF in the PR body now links to the jsDelivr mp4 (checked: HTTP 200, video/mp4). The PR body names T-057 for the CoreMIDI crash. The CI e2e run (37217636555, on the pre-rebase commit) was still in progress. New PR lines: branch: fix/e2e-server-startup; pr: #85 https://github.com/radio-crestin/church-hub/pull/85; after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@0271f9c021273d1ad17196e61b50c9f816664db1/pr-demos-fix-e2e-server-startup/T-056-after.mp4
- 2026-10-04: E2E starts on the server's "Server Ready" line (no hanging HTTP probe); TEST_PORT=3000 refused. PR #85.

## PR
- Branch: fix/e2e-server-startup
- PR: #85 https://github.com/radio-crestin/church-hub/pull/85
- Videos: after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@0271f9c021273d1ad17196e61b50c9f816664db1/pr-demos-fix-e2e-server-startup/T-056-after.mp4 (no user-visible change)
- Build: pr-build-85 (see the PR's "Test build of" comment)
