---
id: T-085
title: "Songs: the add-song window is too small"
kind: task
level: normal
order: 12
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.844Z
---

## Goal
From the "Church Hub Bugs" WhatsApp group (unsure row in the T-081 ledger, .claude/tasks-private/whatsapp-requests.tsv): the add-song modal is too small. Read the original message with the whatsapp-requests skill, confirm on the current build, then fix.

## Notes

- 2026-10-06: 2026-10-06 Song editor window: was max 896px wide, 90% tall; now fills the window (1rem margin) up to 1280px wide, full height. Commit b827d175 on fix/bigger-add-song-window. Spec e2e/song-editor-modal-size.spec.ts (1920x1080 desktop, 1024x600 small window) + modal pickers/escape/bookmark specs green. Not verified: phone width; the panels that open this window are hidden on the phone layout, so it can't be opened there (CSS still caps width at 100vw-2rem). Before/after screenshots in scratchpad before/ and after/. Full suite not run yet (after acceptance).
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-085/church-hub-T-085.app

### For the user
Links:
Local build: [church-hub-T-085.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-085/church-hub-T-085.app)
Question:
T-085 Bigger add-song window
What changed: the window for editing a song now fills almost the whole screen, so the lyrics and fields have more room.
To try it: open the app, go to Cântări, then in Marcaje or Programe click the pencil next to a song.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-085/church-hub-T-085.app
Is everything OK?
- 2026-10-06: e2e: 740/740 green, b827d175
- 2026-10-06: Video: [T-085.mp4](../tasks_videos/T-085.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/136
Finished: full tests pass (740/740, b827d175)
- 2026-10-06: The song editor window now fills the screen (up to 1280px wide, full height) instead of max 896px; e2e spec added; full suite 740/740 green. PR #136 merged.
