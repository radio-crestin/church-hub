---
id: T-087
title: "Marcaje: load a program's songs into the bookmarks"
kind: task
level: normal
order: 10
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-06T21:05:18.844Z
---

## Goal
From the "Church Hub Bugs" WhatsApp group (unsure row in the T-081 ledger): load the songs of a program into marcaje. Read the original message with the whatsapp-requests skill before designing.

## Notes

- 2026-10-06: Video: [T-087.mp4](../tasks_videos/T-087.mp4)
Done. Original (2026-07-30): "Cântările din program să poate fi încărcate în marcaje". Branch feat/program-songs-to-marcaje (from main after T-088's squash), commits 6975f649, b88d97de, a69b1360. Programe panel header: bookmark-plus button adds the program's songs to Marcaje in program order, after existing ones, each song once; toast with count / "already in Marcaje". Marked→program action icon back to calendar-plus to tell them apart; panel header tooltips open left (were cut at the window edge). Client only (useAddSongsToBookmarks loops the existing endpoint). Spec e2e/program-songs-to-marcaje.spec.ts; panel-header-overflow.spec.ts updated. Full suite after acceptance.
PR: https://github.com/radio-crestin/church-hub/pull/146
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-087/church-hub-T-087.app

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-087/church-hub-T-087.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-087/church-hub-T-087.app)
Question:
T-087 Load a program's songs into Marcaje
What changed: a new button at the top of the Programe panel adds all the program's songs to Marcaje, in order. Songs already marked are not added twice.
To try it: open a song, pick a program with songs in the Programe panel, click the bookmark button with a + at the top of the panel.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-087/church-hub-T-087.app
Is everything OK?
- 2026-10-06: Finished: full tests pass. e2e: 752/786 green (34 skipped, 0 failed, 0 flaky), a69b1360 (up to date with main). PR #146 updated.
- 2026-10-06: Button at the top of the Programe panel adds the program's songs to Marcaje, in order, skipping ones already marked; full suite 752/786 green. PR #146 squash-merged.
