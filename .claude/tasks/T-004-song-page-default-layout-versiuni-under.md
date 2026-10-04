---
id: T-004
title: Song page default layout — Versiuni under the song preview
sprint: 2026-10-05
urgent: false
status: done
owner: song-editor
rolled: 0
order: 1
created: 2026-10-04
---
## Goal
Chat 12/07 BCEV: «poate ar fi ok sa putem muta Versiunile cantarilor sub preview-ul cantarii pentru ca acel spatiu nu este folosit mai niciodata..». Panels are draggable (53ea8dc5) but the default puts Versiuni in column 3 under Marcaje/Programe. Change the default layout (migrate users still on the default).

## Notes
- 2026-10-05: branch: feat/song-page-versions-default
pr: #105 https://github.com/radio-crestin/church-hub/pull/105
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@56d77988d693232f2a38315cb8f576e8603af14c/pr-demos-feat-song-page-versions-default/song-page-versions-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@56d77988d693232f2a38315cb8f576e8603af14c/pr-demos-feat-song-page-versions-default/song-page-versions-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-105/church-hub-macos-arm64-pr-105-e529ff2.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-105/church-hub-windows-x64-pr-105-e529ff2.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-105/church-hub-linux-x64-pr-105-e529ff2.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-afdaadd7c6b105ad4/.review-build/T-004/church-hub-T-004.app
commit e529ff28 (from main). Default classic layout is now slides | control + versions | bookmarks + schedules; devices whose stored layout equals the old default are migrated (stored layout cleared once). Tests: clearLayoutArrangedLike.test.ts, e2e/song-page-default-layout.spec.ts; the workspace/panel/bookmark/schedule specs that assumed the old default now seed it via e2e/helpers/song-page-layout.ts, ~120 song-page specs pass. Not verified: packaged app by hand.
- 2026-10-05: Closed by the user. Versiuni starts under the song preview; devices on the old default move once. PR #105 merged.
