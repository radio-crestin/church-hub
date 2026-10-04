---
id: T-007
title: Amin and first/last-slide animations in step with the lyrics
sprint: 2026-10-05
urgent: false
status: done
owner: slide-animations
rolled: 0
order: 7
created: 2026-10-04
---
## Goal
Chat 21/06 BCEV: «cand se da next la ultima strofa din cantare, 'Amin' nu are animatie la fel ca versurile... (atm apare instant)»; 18/06 BCEV: «in noul feature cu primul/ultimul slide, animatiile nu sunt afisate in acelasi timp ca textul principal». Amin default config has no slideTransition (defaultConfigs.ts ~228-240; ScreenContent.tsx 421-445). Amin, gama and first/last-slide elements animate with the same timing as the main text.

## Notes
- 2026-10-05: branch: fix/amin-first-last-slide-animations
pr: #100 https://github.com/radio-crestin/church-hub/pull/100
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@68447bc0e5c77a18ebb8ca39a457adf59d119c89/pr-demos-fix-amin-first-last-slide-animations/before---song-key-and-Amin-follow-the-lyrics.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@68447bc0e5c77a18ebb8ca39a457adf59d119c89/pr-demos-fix-amin-first-last-slide-animations/after---song-key-and-Amin-follow-the-lyrics.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-100/church-hub-macos-arm64-pr-100-50ec34e.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-100/church-hub-windows-x64-pr-100-50ec34e.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-100/church-hub-linux-x64-pr-100-50ec34e.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-adbf496804b1710fb/.review-build/T-007/church-hub-T-007.app
Root cause: key (gama) and Amin were mounted only on the slide that has them (ScreenContent returned null otherwise), so they popped in/out instead of taking the lyrics' fade path. Fix: keep mounted, text comes and goes; first/last layouts fall back to the song layout for the other element. Test: app/apps/client/e2e/song-element-animations.spec.ts (fails on main, passes now). Not verified: webkit (browser not installed), packaged app. defaultConfigs' `slideTransition` field is unused by the renderer (real fields: slideTransitionIn/Out); left untouched. Commit 50ec34e4.
- 2026-10-05: Closed by the user. Amin and song key stay mounted and fade with the lyrics, also between first/last-slide layouts; PR #100 merged.
