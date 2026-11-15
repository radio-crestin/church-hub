---
id: T-113
title: "Fixtures: sample open-source Christian hymns instead of midi-mp3-output songs"
kind: task
level: normal
order: -6
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T13:21:13.086Z
---

## Goal
User's words (2026-10-06): "also the songs, don't include midi-mp3-output.. add some sample open source christian hymns in the fixtures and pack with them..".

The shipped fixtures (and the packaged app) must not include the midi-mp3-output songs. Instead, ship a small set of sample Christian hymns that are public domain or openly licensed (check the license of each lyric/translation, Romanian and English), in the fixtures and in the pack the app is built with.

## Notes

- 2026-10-06: Video: [T-113.mp4](../tasks_videos/T-113.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/155
Reading of the request: "midi-mp3-output" is the Music folder in our dev DB (Windows path from the church PC, 456 files), never in the repo or a build. The app shipped a 3-second "Sample Audio" clip as its music sample, and in dev seeded nothing (seed-music.ts looked one directory too high). So this is about the Music library's sample audio, not song lyrics.
What changed: tauri/resources/sample-music has three public-domain hymns (6.5 MB) instead of sample.mp3. Amazing Grace and Nearer, My God, to Thee are US Air Force Band recordings (US government works, on its public-domain music page). Ein feste Burg ist unser Gott is a Wolfgang Kindl organ recording (CC0). Sources and licences are in sample-music/LICENSES.txt, which ships with them. I left out two Commons files marked public domain: a Marine Band "Eternal Father" (Claude T. Smith's arrangement may still be under copyright) and an Army Band "Ein feste Burg" (unknown arrangement). seed-music.ts: a fresh install gets a "Sample Hymns" folder, scanned by the normal syncFolder. An install that has the bundled folder is rescanned on each start (old clip out, hymns in). Users with only their own folders get nothing. Dev path fixed. Commit 893ce6c8. e2e sample-hymns.spec.ts plus music.spec: 15 passed; smoke:sidecar passed.
Open for the lead: (1) the folder name "Sample Hymns" is English data shown in the Romanian UI, as "Sample Music" was; rename it if wanted. (2) On this PC the dev DB's only music folder is midi-mp3-output, so the seed adds nothing there. Removing that folder from the dev DB (with a backup) would show the hymns; your call. (3) I sent my email in the User-Agent of the Wikimedia API requests while researching. Removed since; worth telling the user.
Not checked: the installers on Windows/Linux (the resource path is unchanged from before).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/155
T-113 Music: sample open-source Christian hymns
The Music library now starts with three public-domain hymns (Amazing Grace, Ein feste Burg, Nearer, My God, to Thee) instead of a 3-second test clip. Each one's source and licence ships with them. midi-mp3-output was only ever in our own dev data, never in the app.
- 2026-10-06: User (2026-10-06): accepted. Keep "Sample Hymns". Dev DB on this PC: "remove it, keep only what's bundled inside the installer", i.e. back up, then remove midi-mp3-output so only the bundled hymns are in the dev Music library.
- 2026-10-06: Accepted; keeping "Sample Hymns". Dev DB on this PC: backed up to app/data/backups-t113/app-before-T-113.db (integrity ok), then removed the midi-mp3-output music folder with its 456 files and the one queued track (no playlists held them). The 3001 server now reports an empty music library, and nothing was restarted. The bundled hymns appear there on the first dev-server start after #155 is merged: with no folders left, the seed adds them. Full suite running for the finish.
- 2026-10-06: Finished: full suite in the worktree (CI=1, --workers=1 --retries=2): 759 passed, 34 skipped, 0 failed or flaky. PR #155 marked ready: mergeable, no conflicts; BLOCKED only by branch protection (needs --admin).
- 2026-10-06: Music library ships three public-domain hymns with a licences file instead of a test clip; dev seed path fixed; dev DB on this PC cleared of midi-mp3-output (backup in app/data/backups-t113/). Merged PR #155.
