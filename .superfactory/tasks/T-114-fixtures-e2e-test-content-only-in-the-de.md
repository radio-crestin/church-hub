---
id: T-114
title: "Fixtures: e2e test content only in the dev env, never in the shipped fixtures"
kind: task
level: normal
order: -7
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T13:34:27.947Z
---

## Goal
User's words (2026-10-06): "also, the e2e test should be only in our dev env, in the fixtures there shouldn't be there..".

e2e test data (e.g. test songs/slides like "Slide B", "Third slide", the e2e Bible takeover content) must live only in the dev/test environment, not in the fixtures that ship to users. Find every e2e item in the shipped fixtures, move it to e2e/dev-only seeding, and make sure fresh installs get none of it.

## Notes

- 2026-10-06: Video: [T-114.mp4](../tasks_videos/T-114.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/153
What changed: the only e2e item in the shipped fixtures was one song, "E2E Unique Song 1779869811190 e9b5ambhv9n" (lyrics "API test verse 1 / API test chorus") in default-songs.json. It shipped since v0.1.97, dumped from a dev DB an old e2e run had written into; T-030's port guard already stops e2e from writing into the dev DB. Removed it from the fixture. New start-up step migrations/remove-seeded-test-song.ts deletes that exact seeded copy from installs that got it (through deleteSong + search index, after add_sync so the delete syncs). Nothing else in bibles, screens, settings or categories is e2e content. Commit 0845781a. e2e: fixtures-no-test-content.spec.ts (fixture file, fresh install, upgraded install); it plus upgrade-keeps-data, api-comprehensive and song-formatting-tags: 55 passed.
Not in scope, for the lead: (1) the dev DB on this PC still has 12 E2E songs and 6 E2E/DBG programs from runs before T-030; the user said e2e content may stay in the dev env, so I left them. (2) default-settings.json ships personal setup that is not e2e: a WhatsApp custom sidebar item (visible on a fresh install), kiosk_mode_enabled/kiosk_startup_page (no code reads them any more), MIDI live shortcuts (T-115 is changing those). Want me to clean (2), and drop those keys from SAFE_SETTING_KEYS so a dump can't bring them back?
Not checked: the packaged desktop app (fixtures are bundled as-is; the migration is plain bun:sqlite).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/153
T-114 Fixtures: e2e test content only in the dev env
New installs no longer get the test song "E2E Unique Song …", and installs that already have it lose it on their next start. Nothing else in the shipped data came from the tests.
- 2026-10-06: Update (lead's go): the personal setup is cleaned too. default-settings.json no longer has global_keyboard_shortcuts (our MIDI note 40 start/stop live), kiosk_mode_enabled/kiosk_startup_page (unused) or the WhatsApp custom sidebar item. Root cause fixed in the export: those keys are off SAFE_SETTING_KEYS, and the sanitizer drops custom sidebar items (new fixtures/drop-custom-sidebar-items.ts); the fixture was regenerated through that sanitizer. Existing installs keep their WhatsApp link and kiosk keys; the MIDI shortcut on existing installs is T-115's. Commit 2e7b5fa1. Spec renamed to fixtures-only-defaults.spec.ts; it plus seeded-secrets and settings: 44 passed. New video, PR #153 updated. Merge note: #154 (T-115) edits global_keyboard_shortcuts in default-settings.json, which this PR deletes; whichever merges second keeps the key deleted.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/153
T-114 Fixtures: e2e test content only in the dev env
New installs start with defaults only: no "E2E Unique Song" test song, and none of our own setup (MIDI live shortcut, WhatsApp sidebar link, old kiosk settings). Exporting the defaults again leaves our setup out too. Installs that already have the test song lose it on their next start.
- 2026-10-06: User (2026-10-06), asked if T-114 is OK, answered: "set the shortcuts from F4 and assign them nicely for each page, make sure to put them in order". Routed to T-119 (shortcuts teammate). T-114 itself not yet accepted.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: Finished: full suite in the worktree (CI=1, --workers=1 --retries=2): 760 passed, 34 skipped, 1 flaky. The flaky one was song-text-mode-scroll.spec.ts "keeps the slide buttons level…", which passed on retry and has nothing to do with fixtures. PR #153 marked ready: mergeable against the current main (which now has #154 and #155), no conflicts; BLOCKED only by branch protection (needs --admin). T-119 (shortcuts) builds on it.
- 2026-10-06: Shipped fixtures hold only defaults: test song removed (and from existing installs), our MIDI/WhatsApp/kiosk setup out; the export's allow-list keeps it out. Merged PR #153.
