---
id: T-020
title: Program page scrolls to the live slide when going verse → song
sprint: 2026-09-28
urgent: false
status: done
owner: programs
rolled: 0
order: -6
created: 2026-10-04
---
## Goal
Chat 07/06 BCEV: «in pagina de programe, cand se trece de la un verset la o cantare, nu se face scroll la slide-ul afisat»; 16/08 BCEV: «intr-un Program, daca dau next de la verset in Cantare, nu isi face scroll la versul respectiv.» (photo 00003148). useFollowPresentedScroll exists in SchedulePanel/ScheduleLiveItemPanel but not on the SchedulePresenter page (ScheduleItemsPanel).

## Notes
- 2026-10-04 Bug already fixed on main: 7f4c9fbd (2026-09-06, in v0.1.96+). The program page DOES use useFollowPresentedScroll, through useScheduleItemExpansion. Old root cause (≤ v0.1.95): the scroll effect returned early when the new live row was not mounted yet. On reading → song, the readings item then closed above the song and pushed slide 1 off the top (same as photo 00003148).
- Change: test only. New e2e/program-page-follows-live-slide.spec.ts walks a program (song → 4 readings → song → reading → song) with Next and →, and checks the live row is on screen at every step. With the old early return put back for a moment, it fails at reading → song; without it, it passes.
- Test: `CI=1 TEST_PORT=3120 bunx playwright test e2e/program-page-follows-live-slide.spec.ts --workers=1 --retries=2` (2 passed).
- Before video: recorded on a temporary build with the old early return put back (the logic from ≤ v0.1.95), not on main, because main no longer has the bug.
- Not checked: packaged Windows app (WebView2).
- Commit: a2f98de0 (rebased onto origin/main; local main has 9 unpushed chore commits).
- 2026-10-04: User review 2026-10-04: wants the full PR link in the review message; re-record videos with red boxes/arrows (T-053 helper) before asking again.

- 2026-10-04 Re-recorded both videos with highlights. Before: the list is boxed, "Bug: live slide 1 is scrolled off the top" (main plus the old early return, temporarily). After: the live slide is boxed, "Fixed: the live slide is in view" (main). Branch rebased onto origin/main da693918. Commit is now 373a5f8e. PR body updated with the v2 videos.
- 2026-10-04: PR lines (v3, with voice-over and red highlights; rebased onto origin/main 0247de61; commit 6dfee6a8):
branch: fix/program-scroll-to-live-slide
pr: #76 https://github.com/radio-crestin/church-hub/pull/76
before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-program-scroll-to-live-slide-v3/t020-before-v3.mp4
after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-program-scroll-to-live-slide-v3/t020-after-v3.mp4
build: pending, "PR build #76" is running (get the links later with pr-build-links.sh 76 --wait)
The before video was recorded on origin/main with the old early return put back for a moment (the ≤ v0.1.95 logic); the after video is plain main.
- 2026-10-04: Already fixed in v0.1.96 (7f4c9fbd); PR #76 adds a regression e2e test (not merged yet).

## PR
- Branch: fix/program-scroll-to-live-slide
- PR: #76 https://github.com/radio-crestin/church-hub/pull/76
- Videos: before: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-program-scroll-to-live-slide-v3/t020-before-v3.mp4, after: https://github.com/radio-crestin/church-hub/releases/download/pr-demos-fix-program-scroll-to-live-slide-v3/t020-after-v3.mp4
