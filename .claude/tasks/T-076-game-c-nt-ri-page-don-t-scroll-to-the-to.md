---
id: T-076
title: Game cântări page — don't scroll to the top after adding a gama
sprint: 2026-10-05
urgent: false
status: done
owner: song-keys-page
rolled: 0
order: 0
created: 2026-10-05
---
## Goal
User 2026-10-05: «dupa ce se adauga gama sa nu se mai dea scroll in sus. on game cantari page..». On the Game cântări (song keys / gamas) page, after you add a gama to a song, the list jumps back to the top. It must keep the scroll position (and the row you just edited in view). Find the root cause (likely a refetch/remount or list key change resetting the scroll), fix it, and cover it with an e2e test that scrolls down, adds a gama, and checks the scroll position stayed.

## Notes
- 2026-10-05: Video: [T-076.mp4](../tasks_videos/T-076.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/116
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a90a6c5f1d2f74b64/.review-build/T-076/church-hub-T-076.app
Root cause: every `song_updated` WebSocket event called `resetQueries` on the Game cântări list (WebSocketContext.tsx). A reset drops the loaded pages: spinner, empty list, scroll goes to 0, and only page 1 comes back. Fix: only `invalidateQueries(['songs'])` (it already covers that list), which keeps the pages on screen while it refetches.
Also fixed: since PR #114 the song page has two gama dialogs, so both inputs had id="keyLine". The label could focus the hidden one, and song-key.spec failed on main. The input now uses useId + data-testid="key-line-input"; song-key, program-gama and page-actions-menu specs are scoped to `dialog[open]`.
Commits: 6cf9390f (scroll fix + e2e), e21b70ca (unique input id).
Test: e2e/song-key-keeps-scroll.spec.ts (fails before the fix: scrollTop 1694 to 0; passes after). 17/17 pass across song-key-keeps-scroll, song-key, program-gama, page-actions-menu. Manual: Game cântări, scroll down, click a song, type a gama, Save; the list must not move.
Not verified: real devices / phone layout; the CI installers were still building when I wrote this.
- 2026-10-05: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-116/church-hub-macos-arm64-pr-116-e21b70c.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-116/church-hub-windows-x64-pr-116-e21b70c.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-116/church-hub-linux-x64-pr-116-e21b70c.AppImage
- 2026-10-05: Game cântări keeps its scroll after saving a gama (song_updated now invalidates instead of resetting the list); gama dialog inputs get unique ids. PR #116 merged.
