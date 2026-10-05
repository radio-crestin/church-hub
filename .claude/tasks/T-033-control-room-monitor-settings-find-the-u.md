---
id: T-033
title: Control-room monitor settings — find the untranslated text
sprint: 2026-10-05
urgent: false
status: done
owner: screens
rolled: 0
order: -4
created: 2026-10-04
---
## Goal
Chat 24/05 BCEV: «pagina de setari din camera de control pentru editarea monitoarelor nu este tradusa si in romana». Locale keys look complete; look for hardcoded strings in the control-room monitor editing components and move them to i18n (en + ro).

## Notes
- 2026-10-05: 2026-10-05 done. branch: fix/monitor-settings-i18n
pr: #113 https://github.com/radio-crestin/church-hub/pull/113
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@cd5eeb7b136c38bfc5dd2c9e4170adf4187190cd/pr-demos-fix-monitor-settings-i18n/t033-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@cd5eeb7b136c38bfc5dd2c9e4170adf4187190cd/pr-demos-fix-monitor-settings-i18n/t033-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-113/church-hub-macos-arm64-pr-113-1f051c8.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-113/church-hub-windows-x64-pr-113-1f051c8.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-113/church-hub-linux-x64-pr-113-1f051c8.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a9ffc1046f60f646d/.review-build/T-033/church-hub-T-033.app
Changed: the editing page is Settings > Screens editor (ScreenEditorSidebar/ScreenEditor/ScreenEditorCanvas, ScreenManager, ScreenExportModal). Hardcoded English (section titles, font/color/bold/italic/underline, alignment buttons, animation types, durations, clock, width/height, element heading, System Default font, Save/Preview/Loading, No Scene, Kiosk, Done) moved to i18n; new en+ro keys (ro via Codex); ro Bold/Italic -> Îngroșat/Cursiv.
Test: e2e/screen-editor-translated.spec.ts + screen-background-media.spec.ts pass (10).
Commits: 14e3cf4f, 1f051c8f. Left out: ControlRoom.tsx (/present) "LIVE"/"(Esc)" hints, rare English sample-text fallbacks in canvas.
- 2026-10-05: Screen editor (Settings → Screens) fully translated: hardcoded English moved to en/ro i18n keys. PR #113 merged. Left: "LIVE"/"(Esc)" on /present still English.
