---
id: T-055
title: "Fix failing e2e: panel-header-overflow \"narrowing the side column\""
sprint: 2026-09-28
urgent: false
status: done
owner: panel-layout
rolled: 0
order: -13
created: 2026-10-04
---
## Goal
Found by the programs teammate (2026-10-04): e2e/panel-header-overflow.spec.ts, test "narrowing the side column…", fails on origin/main (da693918) too — the column-resize drag lands ~197px off. Not caused by the sprint PRs. Find whether the test or the resize code is wrong (root cause, not a retry/timeout bump) and fix it so the spec passes serially (--workers=1 --retries=2) and in CI.

## Notes
- 2026-10-04: Done, awaiting review. Root cause: neither the test nor the resize code. The start-up screen (#loading-screen, fixed, z 9999) fades for 300 ms after mount at opacity 0 but stayed hit-testable (src/router.tsx hideLoadingScreen). Warm page loads finish inside that window, so the spec's raw page.mouse drag hit the overlay (seen with elementFromPoint), selected text, and the column never moved (386.8 vs 190 = the "197px off"). Cold first run passed, warm runs failed 5/5. User-visible too: a first click/drag right after opening is lost. Fix: pointer-events none on hide (error/Retry path never calls hide, Retry stays clickable). Test: new e2e/loading-screen-fade.spec.ts (fails 3/3 without fix, passes with); panel-header-overflow.spec.ts unchanged, 10/10 with --repeat-each=5; with loading-screen-fade + screen-background-media at --workers=1 --retries=2: 12/12. How to test: open any page and drag/click at once, or run those specs with CI=1 TEST_PORT=3155. Commit 929a489d. Not verified: Tauri desktop startup (same function). No PR-build workflow on the PR yet. PR — branch: fix/panel-header-overflow-e2e; pr: #84 https://github.com/radio-crestin/church-hub/pull/84; before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-panel-header-overflow-e2e-v3/T-055-before-v3.mp4; after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-panel-header-overflow-e2e-v3/T-055-after-v3.mp4
- 2026-10-04: Re-recorded with voice-over after rebasing on main (0247de61). The fix commit is now 0d196639, force-pushed once. The before video needs a warm reload to land the drag inside the 300 ms fade, which is the same case the e2e test hit; its first drag was confirmed to land on #loading-screen. The specs pass again on the rebased branch (4/4). PR lines: branch: fix/panel-header-overflow-e2e; pr: #84 https://github.com/radio-crestin/church-hub/pull/84; before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-panel-header-overflow-e2e-v3/T-055-before-v3.mp4; after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-panel-header-overflow-e2e-v3/T-055-after-v3.mp4. The PR-build workflow is now running on the PR (build / plan, pending): https://github.com/radio-crestin/church-hub/actions/runs/37216230133
- 2026-10-04: Loading screen no longer catches input during its 300 ms fade (pointer-events: none); panel-header-overflow e2e passes. PR #84.

## PR
- Branch: fix/panel-header-overflow-e2e
- PR: #84 https://github.com/radio-crestin/church-hub/pull/84
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-panel-header-overflow-e2e-v3/T-055-before-v3.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-panel-header-overflow-e2e-v3/T-055-after-v3.mp4
