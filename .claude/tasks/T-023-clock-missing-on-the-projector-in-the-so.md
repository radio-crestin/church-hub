---
id: T-023
title: Clock missing on the projector in the Solo scene
sprint: 2026-09-28
urgent: false
status: done
owner: projector
rolled: 0
order: -1
created: 2026-10-04
---
## Goal
Chat 16/08 BCEV: «in scena Solo din Program, nu mai apare ceasul pe videoproiector». Scene items present an empty slide (usePresentationContent.ts ~589-595); clock is a per-content-type clockEnabled flag. Show the clock on the projector during scene items.

## Notes
- 2026-10-04 Root cause: `usePresentationContent` rendered a scene item as content type `'scene'`, which no screen has a config for, so the empty slide's clock never showed. It also read a nonexistent `temp.data.sceneId` (the data has `obsSceneName`), which threw mid-update. Fix (`d3d5500c`): a scene item renders as the `empty` slide (its clock, its exit animation). Spec `e2e/scene-item-clock.spec.ts` fails before the fix, passes after; related Chromium projection specs pass.
- Test: `CI=1 TEST_PORT=3123 bunx playwright test e2e/scene-item-clock.spec.ts --workers=1 --retries=2`.
- Not verified: WebKit projects (WebKit not installed locally); OBS switch with a live OBS. Seen twice: the Playwright webServer readiness check sometimes times out after 180 s even though the server is "Ready" (a rerun passes). Looks like an existing flake; not investigated.

- 2026-10-04 Rebased on origin/main (commit now `eb2191b2`, force-pushed). Videos re-recorded with T-053 highlights (red box on the missing clock / on the clock) and re-uploaded at the same URLs. PR body updated.

- 2026-10-04 v3: rebased on origin/main (voice-over helper, 0247de61); commit now `a6593693`, force-pushed. Videos re-recorded with voice-over and highlights, uploaded under the -v3 tag. PR body updated.
- 2026-10-04: Scene items (Solo) now render the empty slide with its own settings, clock included. PR #79 (not merged yet).

## PR
- Branch: fix/clock-on-scene-items
- PR: #79 https://github.com/radio-crestin/church-hub/pull/79
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-clock-on-scene-items-v3/T-023-before.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-clock-on-scene-items-v3/T-023-after.mp4
