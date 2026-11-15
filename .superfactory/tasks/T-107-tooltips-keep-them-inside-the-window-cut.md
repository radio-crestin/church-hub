---
id: T-107
title: "Tooltips: keep them inside the window (cut off at the right edge)"
kind: task
level: normal
order: -3
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T08:00:09.839Z
---

## Goal
Found by programs during T-087/T-088; the user wants it fixed now (2026-10-06). The shared tooltip (app/apps/client/src/ui/tooltip/Tooltip.tsx) doesn't keep itself inside the window, so tooltips on buttons near the right edge are cut off (e.g. the Marcaje panel's header buttons). The Programe panel worked around it by opening its tooltips to the left; once the shared tooltip flips/shifts on its own, that workaround can go. Fix it in the shared component (all edges), e2e spec, PR with the 1080p before/after video.

## Notes

- 2026-10-06: 2026-10-06 tooltips: fixed in the shared tooltip, commit 109984f2 on fix/tooltip-inside-window. New placeTooltip.ts: the tooltip is measured before paint, flips to the opposite side when the asked side has no room, slides along the trigger to keep 8px from every window edge, arrow stays on the trigger's centre; long texts wrap at window width; role="tooltip" added. Spec e2e/tooltip-inside-window.spec.ts (Programe delete button at 1920 and 1280 wide: inside the window, arrow within 2px of the button centre) passes. BEFORE/AFTER screenshots in my scratchpad (before/04-hover-schedule-delete.png shows "Sterge acest progr" cut off; after shows it whole). Not verified: the full e2e suite (waits for the user's yes), tooltips inside a <dialog>. The Programe panel's open-to-the-left workaround (programs teammate's branch, not on main) can go once this lands. Local app: open the link below; stop it by quitting the app; removed by worktree-cleanup.
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-107/church-hub-T-107.app

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-107/church-hub-T-107.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-107/church-hub-T-107.app)
Question:
T-107 Tooltips stay inside the window
What changed: a tooltip near the edge of the window now moves over so its whole text shows, and its little arrow still points at the button.
To try it: open the app, open a song with the Programe panel on the right, choose a program, and hold the mouse over the red delete button at the far right of the Programe header.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-107/church-hub-T-107.app
Is everything OK?
- 2026-10-06: Video: [T-107.mp4](../tasks_videos/T-107.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/148
2026-10-06 PR opened with the 1080p before/after video (attached in the PR). Full e2e suite running now on 109984f2; result line follows.

### For the user
Links:
PR: [https://github.com/radio-crestin/church-hub/pull/148](https://github.com/radio-crestin/church-hub/pull/148)
Video: [T-107 before/after](https://github.com/user-attachments/assets/cfc849f8-6852-4dd3-9453-5488dbe7c2de)
Question:
T-107 Tooltips stay inside the window
What changed: a tooltip near the edge of the window now moves over so its whole text shows, and its little arrow still points at the button.
To try it: open the PR and play the video: before, the delete button's tooltip in the Programe panel is cut off; after, it shows whole.
https://github.com/radio-crestin/church-hub/pull/148
Is everything OK?
- 2026-10-06: e2e: 753/753 green (752 passed + 1 flaky that passed on retry: song-open-other-church-hub, unrelated; 34 skipped), 109984f2
Finished: full tests pass. PR https://github.com/radio-crestin/church-hub/pull/148 with the video. The Programe panel's open-to-the-left tooltip workaround can be removed once this merges.
- 2026-10-06: Shared tooltip measures itself, flips and slides to stay inside the window, arrow on the button; e2e spec; full suite 753 green. PR #148 squash-merged.
