---
id: T-019
title: Solo → song in a program doesn't switch the OBS scene
sprint: 2026-09-28
urgent: true
status: doing
owner: livestream-obs
rolled: 0
order: -3
created: 2026-10-04
---
## Goal
Chat 24/05 BCEV [La Programe]: «cand se trece de pe solo in cantare nu se muta scena. (ramane pe solo)». useScheduleFlatNavigation.ts 330-357 switches the scene for scene items; obs/content-type-detector.ts has no 'scene' branch (treated as empty) and nothing switches back when a song follows. Fix with a test.

## PR
- Branch: fix/obs-scene-solo-to-song
- PR: #75 https://github.com/radio-crestin/church-hub/pull/75
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-obs-scene-solo-to-song/T-019-before.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-obs-scene-solo-to-song/T-019-after.mp4

## Notes
- 2026-10-04: DONE (livestream-obs). Root cause: POST /api/presentation/temporary-scene was the only presentation route that never ran scene automation, so automation still remembered song_schedule from the song before Solo; the next song looked "unchanged" and OBS stayed on Solo. Fix c0db8021: the route calls triggerSceneAutomation; detectContentType returns 'scene'; handleContentTypeChange('scene') only records lastContentType='scene' (no switch, because the item already switched OBS). New type LiveContentType; 'scene' is not added to CONTENT_TYPES. Test: cd app/apps/client && CI=1 TEST_PORT=3119 bunx playwright test e2e/obs-scene-automation-program.spec.ts --workers=1 --retries=2 (fails on main, passes on the branch); livestream-integration.test.ts 17/17 pass. Not verified: real OBS (app-only custom scenes, same switchScene path). PR section — branch: fix/obs-scene-solo-to-song; PR: #75 https://github.com/radio-crestin/church-hub/pull/75; videos before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-obs-scene-solo-to-song/T-019-before.mp4 after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-obs-scene-solo-to-song/T-019-after.mp4. Note: local main has 9 unpushed chore commits; PR branch was rebased onto origin/main so it holds only the fix. Worktree isolation blocked editing the task file's ## PR section directly: lead, please copy these lines there.
- 2026-10-04: User review 2026-10-04: not resolved yet. Re-record before/after videos with red boxes/arrows on the bug and the fix (T-053 helper), then ask again with the full PR link.
