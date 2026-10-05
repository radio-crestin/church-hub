---
id: T-041
title: Shortcuts — focus-only vs global option, and respect permissions
sprint: 2026-10-05
urgent: false
status: done
owner: shortcuts
rolled: 0
order: -3
created: 2026-10-04
---
## Goal
Chat 07/06 Bogdan: «când e deschisă altă aplicație, de exemplu, BibleShow, comenzile tip F1..F12, sunt captate de program, chiar dacă e minimizat...»; Iosif: «ar trebui facut optional acest behaviour sa poti selecta daca vrei cu focus in aplicatie sau nu»; Bogdan: «când un user nu are permisiunea de a vizualiza, de exemplu youtube, comenzile rapide ... să nu meargă». Navigation shortcuts are already frontmost-only; presentation/scene/OBS shortcuts are always global with no setting; useSidebarItemShortcuts.ts has no permission filter. Add the setting and the permission filter.

## Notes
- 2026-10-05: 2026-10-05 shortcuts teammate. What changed: (1) Settings > Shortcuts has a new switch "Only when Church Hub is in front" (off by default). On: presentation, live stream and OBS scene keys (F1-F12...) are let go while another app is in front, like the navigation keys already were (config field onlyWhenAppFocused in global_keyboard_shortcuts; guard in useGlobalAppShortcuts). (2) Shortcuts follow permissions: sidebar and page shortcuts skip pages the user cannot see (same rule as the sidebar); show/next/prev need control_room.control (what the server asks); start/stop live + OBS scenes need the Livestream page permission (settings.view). MIDI is unchanged (server-side). Commits: 5417bfc5, 4b788930. Tests: vitest keyboard-shortcuts + sidebar-config (87 pass, the new focus-only test fails without the guard); e2e shortcuts-focus-and-permissions.spec.ts passes; regression e2e (keyboard-shortcuts, bible-search-shortcut, page-scoped-shortcuts, sidebar-config, presentation-controls) 29 pass. How to test in the desktop app: switch on, focus another app, press a Next Slide key -> it goes to that app; click back into Church Hub -> key works again; switch off -> works from anywhere as before. Signed in as a songs-only user, F6 (Bible) does nothing. Not verified: the real OS-wide behaviour in the desktop app on macOS/Windows/Linux (a browser cannot press OS-wide keys); covered by unit tests on the registration logic only.
- 2026-10-05: PR lines:
branch: feat/shortcuts-focus-only-and-permissions
pr: #115 https://github.com/radio-crestin/church-hub/pull/115
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@6df9a1337e5f222e4a53a77109550532bf18d7b1/pr-demos-feat-shortcuts-focus-only-and-permissions/t041-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@6df9a1337e5f222e4a53a77109550532bf18d7b1/pr-demos-feat-shortcuts-focus-only-and-permissions/t041-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-115/church-hub-macos-arm64-pr-115-4b78893.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-115/church-hub-windows-x64-pr-115-4b78893.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-115/church-hub-linux-x64-pr-115-4b78893.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-ad5e6b67c0a9d5f50/.review-build/T-041/church-hub-T-041.app (build of commit 4b788930)
- 2026-10-05: New "only when Church Hub is in front" shortcut switch (off by default); shortcuts for pages/actions the user lacks permission for do nothing. PR #115 merged.
