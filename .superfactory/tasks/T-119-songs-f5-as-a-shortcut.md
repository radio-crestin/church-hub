---
id: T-119
title: "Songs: F5 as a shortcut"
kind: task
level: normal
order: -10
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T14:54:53.997Z
---

## Goal
User's words (2026-10-06): "set also f5 as shortcut for songs".

Add F5 as a keyboard shortcut for songs, like F5 in presentation software: start presenting the selected/open song (from the first slide). Check the existing song/presentation shortcuts first and fit with them; make sure it works in the Tauri app and the browser (F5 must not reload the page there), on macOS, Windows and Linux.

## Notes

- 2026-10-06: 2026-10-06: Findings. (1) F5 already presents the selected slide on the song page (useSongSlideSelectionKeyboard.ts, page priority; e2e presenter-remote.spec.ts, for clicker "present" button). (2) Sidebar keys default Present=F4, Bible=F6, Schedules=F7, Songs=none (server/src/db/fixtures/default-settings.json, seeded INSERT OR IGNORE), so "F5 for songs" most likely means Songs sidebar key = F5 (open Songs + focus search). Conflict: sidebar keys are captured first / held OS-wide in Tauri, so F5=Songs would stop the clicker's F5 from presenting on the song page. Asked lead which meaning.
- 2026-10-06: User (2026-10-06, answering about T-114's default settings): "set the shortcuts from F4 and assign them nicely for each page, make sure to put them in order". Lead's decision on the teammate's question: go with the proposal (F5 = Songs sidebar key, opens Songs + focuses search; on an open song page F5 still presents, in browser and in the Tauri global handler) AND extend it: default sidebar shortcuts from F4 upward, one per page, in the sidebar's order. Migration for existing installs only where the page has no key and the F-key is unused. default-settings.json is touched by T-114 (#153, dev-fixtures): build on top of it once merged, or coordinate.
- 2026-10-06: 2026-10-06: Implemented on task/T-119 (worktree .claude/worktrees/T-119, port 3219), commit d6799e24. Defaults: present F4, songs F5, bible F6, schedules F7, music F8, song_key F9, live_translation F10, livestream F11 (was F8). Sidebar keys first offer the key to the open page (utils/pageKeyClaimEvent.ts, browser + Tauri paths); song page claims F5 and presents. Migration assign-default-page-keys.ts fills empty pages with unused keys, once. e2e songs-f5-shortcut.spec.ts + presenter-remote, bible-search-shortcut, page-scoped-shortcuts pass. Caveat: F11 is macOS "Show Desktop" by default, so the livestream key may not reach the app there. Waiting for T-114 (#153) to rebase the fixture, then video + PR.
- 2026-10-06: User (2026-10-06): Livestream gets F12 (macOS takes F11 for Show Desktop). Order: Present F4, Songs F5, Bible F6, Schedules F7, Music F8, Song key F9, Live translation F10, Livestream F12.
- 2026-10-06: 2026-10-06: Livestream default changed to F12, F11 left free (0fb6dd61). Waiting for T-114 merge to rebase, then video + PR.
- 2026-10-06: 2026-10-06: Done (draft). Video: [T-119.mp4](../tasks_videos/T-119.mp4). PR: https://github.com/radio-crestin/church-hub/pull/158. app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-119/church-hub-T-119.app
Rebased on main after T-114; commits bc5bbfae (keys F4 upward, F5 yields to song page, migration, e2e) and e2000203 (Livestream F12, F11 free). Checked: new spec + presenter-remote, bible-search-shortcut, page-scoped-shortcuts; migration on sample DB. Not checked: the OS-wide F-key behaviour in the desktop app on Windows/Linux, and whether macOS lets F12 through (it is free by default). Full suite after the user's yes.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/158
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-119/church-hub-T-119.app
T-119 Songs: F5 as a shortcut
Each page in the sidebar now has its own key, in order from F4 (Songs is F5, Livestream F12; F11 is left free). F5 opens Songs with the search ready; on an open song, F5 still presents it. Existing installs get the missing keys too, without overwriting the keys you have already set.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: 2026-10-06: Accepted. Full suite (CI=1, --workers=1 --retries=2): 770 passed, 34 skipped, 0 failed. PR #158 marked ready.
- 2026-10-06: Sidebar pages get F-keys in order from F4 (Songs F5, Livestream F12, F11 free); F5 still presents on an open song; existing installs get missing keys once. Merged PR #158.
