---
id: T-112
title: Professional, easy-on-the-eyes transitions for Bible verses and every slide type
kind: task
level: normal
order: -5
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T14:27:51.445Z
---

## Goal
User's words (2026-10-06): "make sure to configure some professional transitions as in Big Churches also for Bible verses and all the other slides, make them easy for the eyes".

Give the default slide designs (fixtures and factory designs for new screens/installs) calm, professional transitions like the ones large churches use (e.g. short soft crossfades, no flashy motion) for Bible verses, songs and every other content type, on every screen (Main, Stage, Live Stream, Kiosk). Rendering goes through usePresentationContent. Pick timings that are gentle on the eyes and consistent across content types; show them in the before/after video.

## Notes

- 2026-10-06: Started on branch task/T-112.
- 2026-10-06: 2026-10-06 transitions: BEFORE measured on a recording: verse change = 0.45 s blink (200 ms fade-out to empty, 250 ms in, easing ignored, always ease-out); hide = 0.2 s snap; first show and song->verse = hard cuts (element mounting visible skipped its fade; old type unmounted at once). Done on task/T-112 (2 commits): factory design calm eased fades on every text element/screen (show 500, hide 400, slide change 300 out + 400 in, ease-in-out); renderer honours easing; fade-in on mount; usePresentationContent hands over between content types (old fades out, new fades in); one-time migration upgrades screens still on earlier factory transitions (customised ones kept). Spec e2e/calm-transitions.spec.ts (8 pass) + 113 presentation-related specs pass. Next: before/after video, PR.
- 2026-10-06: Video: [T-112.mp4](../tasks_videos/T-112.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/156
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-112/church-hub-T-112.app (port 4212, own data; open the file:// link)
Done (2026-10-06). Commits on task/T-112: aaa57fbc calm eased fades in factory design + renderer honours easing + one-time migration for screens on old factory transitions; 5824fad5 fade-in on mount + content-type handoff in usePresentationContent (useContentTypeHandoff); 173365a9 fix stale song key after a song (showContent sets type/data/key together), which made every verse after a song hard-cut.
Timings (all fade, ease-in-out): slide change 300 out + 400 in, show 500, hide 400; song->verse ~0.9 s.
Checked: e2e/calm-transitions.spec.ts 8 pass; 117 presentation-related specs pass (29 skipped); migration checked by hand on an in-memory DB (old sets upgraded, customised kept, runs once); before/after measured frame by frame on recordings.
Not checked: OBS scene overrides (screen_scene_overrides, livestream's area) keep whatever transitions they store; the background still switches instantly on a content-type change (with the factory's black backgrounds you can't see it, but you can with different image backgrounds per type). Full suite after the user's yes.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/156
T-112 Professional, easy-on-the-eyes transitions for Bible verses and every slide type
On every screen, text now fades softly in and out. That covers the next verse, the next song slide, going from a song to a verse, and showing or hiding the text. Before, the text cut in, or blinked out and back in. Your existing screens get the same fades, unless you changed their transitions yourself.
- 2026-10-06: Finished: full suite 763 passed (CI=1 TEST_PORT=3212, --workers=1 --retries=2, 13.5 min). PR #156 marked ready, description checked as T-112's own. PRs have no GitHub checks. Scratch files are in scratchpad/T-112/.
- 2026-10-06: Rebased onto main (after T-114, T-115, T-113). The only conflict was the migration list in migrations/index.ts: kept both remove_seeded_test_song (T-114) and upgrade_factory_transitions, in that order. Main's T-110 getMissingContentConfig makes first/last song slides inherit the saved song design, transitions included, so it works with this change. Full suite on the rebased branch: 773 passed, 34 skipped. Pushed; PR #156 is MERGEABLE (blocked only by branch protection, needs --admin) with no review comments.
- 2026-10-06: Calm eased fades on every screen and content type (slide change 0.3+0.4 s, show 0.5 s, hide 0.4 s, type handoff ~0.9 s); stale song key fixed; existing screens on factory transitions upgraded. Merged PR #156.
