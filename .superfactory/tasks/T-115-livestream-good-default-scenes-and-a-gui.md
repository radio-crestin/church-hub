---
id: T-115
title: "Livestream: good default scenes and a guide to connect everything and create the first scene"
kind: task
level: normal
order: -8
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T13:21:11.660Z
---

## Goal
User's words (2026-10-06): "also, same for livestream scenes and so on.. add a guide how to connect each thing, how to create the first scene and so on..". ("same" = like the professional defaults asked for slides in T-112 and the clean fixtures in T-113/T-114.)

1. Ship sensible, professional default livestream scenes (OBS scenes, MIDI shortcuts like scene:rugaciune, etc.) in the fixtures, with nothing from our own testing setup.
2. Add an in-app guide that walks a new church through connecting each thing (OBS, MIDI, screens, YouTube/stream, etc.) and creating their first scene. English and Romanian.

## Notes

- 2026-10-06: Started: exploring livestream feature, default scenes and fixtures.
- 2026-10-06: Env: port 3215 (worktree-setup done). BEFORE (fresh DB): /livestream shows no scenes, only "Nicio scena disponibila. Apasa pe iconita de setari..." though no settings icon is on the page; no guide. Screenshot: scratchpad/before-livestream.png. Fixture default-settings.json has test setup startLive/stopLive on midi:note_on:40 (mine to clean; dev-fixtures does the rest of that file in T-114). obs_scenes has no seed at all.
- 2026-10-06: Branch task/T-115, 3 commits. Default scenes seeded once (fixtures/default-obs-scenes.json, migrations/seed-obs-scenes.ts): Început(start), Predică, Cântare(songs auto), Biblie(bible auto), Rugăciune, Anunțuri(announcement auto), Final(stop). Fixture: startLive/stopLive midi:note_on:40 removed. Guide modal (components/guide/*) from a "Setup guide" button on Live Stream + empty grid: 7 steps (OBS, browser source URL/size, first scene + checklist with In OBS badges, switching, MIDI, mixer, YouTube), en+ro (ro via Codex). Fixed: Esc on nested OBS setup closed the guide. e2e livestream-setup-guide.spec.ts passes; obs-scene-automation-program spec adapted (puts its song scene first). Not tested against a real OBS (In-OBS badges rely on existing isCustom logic). Note for lead: fixture Live Stream screen is 1080x420, odd size for an OBS browser source (not my area).
- 2026-10-06: Video: [T-115.mp4](../tasks_videos/T-115.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/154
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-115/church-hub-T-115.app (port 4215, own data; open it from Finder or `open` it)
Commits: af24aa21 default scenes seed + MIDI test shortcuts removed; 43b8460a setup guide; 51eb92c5 e2e.
Checks: livestream-setup-guide, obs-scene-automation-program, livestream specs pass (CI=1 TEST_PORT=3215). Tried as a user in headless Chromium, desktop and phone width.
Not checked: against a real running OBS (the "In OBS" badges use the existing scene sync), the review app by hand.
Lint: my files are clean; `bun run lint` still fails on main's existing errors (19, other files).

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/154
T-115 Livestream: good default scenes and a guide
A new install now starts with 7 ready scenes (Început, Predică, Cântare, Biblie, Rugăciune, Anunțuri, Final). Songs, Bible verses and announcements switch to their scene on their own, and our test MIDI shortcuts are gone. A new "Ghid de configurare" on the Live Stream page walks through OBS, the first scene, MIDI, the mixer and YouTube, in Romanian and English.
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-115/church-hub-T-115.app
- 2026-10-06: Video: [T-115.mp4](../tasks_videos/T-115.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/154
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-115/church-hub-T-115.app (port 4215, own data)
Commits: af24aa21 default scenes + fixture MIDI cleanup, 43b8460a setup guide, 51eb92c5 e2e.
Checked: livestream-setup-guide, obs-scene-automation-program, livestream specs pass (CI=1 TEST_PORT=3215); tried as a user in headless Chromium (desktop + 390px mobile). Not checked: against a real running OBS (the "In OBS" badges use the existing scene sync). Full suite after the user's yes.
Open for lead: fixture Live Stream screen is 1080x420 (odd for an OBS browser source; not my area). dev-fixtures asked you whether global_keyboard_shortcuts should leave SAFE_SETTING_KEYS so dumps stop copying MIDI mappings back.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/154
T-115 Livestream: good default scenes and a guide to connect everything and create the first scene
A new install now has 7 ready livestream scenes (Început, Predică, Cântare, Biblie, Rugăciune, Anunțuri, Final) that switch by themselves for songs, Bible and announcements, and a "Ghid de configurare" on Live Stream walks through OBS, the first scene, MIDI, mixer and YouTube, in Romanian and English.
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-115/church-hub-T-115.app
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-06: Accepted by user. Full suite running (CI=1 TEST_PORT=3215, --workers=1 --retries=2), log in scratchpad/full-suite.log.
- 2026-10-06: default-settings.json edit dropped from #154 (bd69de30): T-114 (#153) deletes global_keyboard_shortcuts from the fixture. Lead agreed: no migration for existing installs' MIDI note-40 shortcuts.
- 2026-10-06: Full suite: 757 passed, 1 flaky (program-page-follows-live-slide, passed on retry, not this area), 34 skipped. PR #154 marked ready, description updated (MIDI shortcuts left to T-114).
- 2026-10-06: 7 default livestream scenes for new installs, auto scene switching, and a 7-step setup guide (EN/RO); our MIDI note-40 shortcut out of defaults. Merged PR #154.
