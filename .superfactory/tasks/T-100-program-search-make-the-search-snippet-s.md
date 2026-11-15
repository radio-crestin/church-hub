---
id: T-100
title: "Program search: make the search snippet safe to show"
kind: task
level: normal
order: -3
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:23:15.355Z
---

## Goal
The user asked to fix this now (2026-10-06): "fix it now, better-tasks already is working on a generic fix but you can fix it here for yourself". Found by the automatic security review while T-088 was in progress; already on main, not caused by T-088. Details are only in the private note .claude/tasks-private/T-088-security-notes.md. Per the project rule, keep the details out of this file, commit messages and the PR. Done = the program search snippet is shown safely, other search results that show snippets the same way are checked too, an e2e spec covers it, and the full e2e suite is green.

## Notes

- 2026-10-06: 2026-10-06 (search-security): done, waiting for the user's try. Branch fix/safe-search-snippets, commit d03ab6b6.
- What changed: program, song and verse search results now show their text through one shared component (app/apps/client/src/ui/search/HighlightedText.tsx): plain text, only the matched words highlighted, same look as before. Used by ScheduleCard, SongCard (title + lyrics line), BibleNavigationPanel and VerseCard. Server unchanged.
- Test: e2e/search-snippets-text.spec.ts (program + song search). Nearby specs green: search, search-diacritics, bible, bible-search-shortcut, schedules, songs, the new one: 48/48. Full suite waits for the user's yes.
- Before/after screenshots (1920x1080) in my scratchpad t100/before and t100/after.
- Not verified by hand: the Bible search result list (no translation in my scratch data); covered by the same component and by bible.spec.ts.
- Details for the private file: sent to the lead as a scratchpad path.
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-100/church-hub-T-100.app (port 4200, own data; remove: bun app/scripts/worktree-cleanup.ts T-100 fix/safe-search-snippets)

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-100/church-hub-T-100.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-100/church-hub-T-100.app)
Question:
T-100 Program search: make the search snippet safe to show
What changed: search results for programs, songs and Bible verses show their text exactly as typed, with only the searched words highlighted.
To try it: open the app, go to Programe and search for a program, then do the same in Cântări and Biblia. The highlighted words should look as before.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-100/church-hub-T-100.app
Is everything OK?
- 2026-10-06: Video: [T-100.mp4](../tasks_videos/T-100.mp4)
e2e: 740/740 green (34 skipped, 774 total), d03ab6b6
PR: https://github.com/radio-crestin/church-hub/pull/139
Finished: full tests pass. The video uses a neutral example (formatting tags in a name), no security details in the PR or video.
- 2026-10-06: User on PR #139 (2026-10-06): "but i still see <b> and so on.. i don't want this.. i want clear text inside the imported songs as i told you last time..". Not accepted yet. T-100 waits for T-104 (song-cleanup: migration that strips <i>/<b>/etc. from all songs + Resurse Creștine import filter). Once T-104 is merged: rebase T-100 on main, check search results show clean text (no literal tags), redo the after part of the video, update PR #139, report done again.
- 2026-10-06: Rebased on main after T-104 (f1aef3e0): branch fix/safe-search-snippets now 03156202. Checked: a song downloaded with <b>/<i> tags now shows clean text in song search (title and lyrics line), searched words highlighted. Nearby specs green on 03156202: 42 passed (search-snippets-text, song-formatting-tags, search, search-diacritics, schedules, bible). Full suite runs after acceptance. New video (download + search, before/after), PR #139 body and video updated.
Video: [T-100.mp4](../tasks_videos/T-100.mp4)

### For the user
Links:
PR: [https://github.com/radio-crestin/church-hub/pull/139](https://github.com/radio-crestin/church-hub/pull/139)
Video: [T-100 before/after](https://github.com/user-attachments/assets/f8a96e4e-9b23-4d17-9b6c-b68442a9fa55)
Question:
T-100 Search results show clean text
What changed: songs downloaded from Resurse Creștine come in without tags like <b> and <i>, and search results for songs, programs and Bible verses show clear text with only the searched words highlighted.
To try it: open the link and watch the video at the top. In the app: download a song, then search for it on Cântări.
https://github.com/radio-crestin/church-hub/pull/139
Is everything OK?
- 2026-10-06: e2e: 746/746 green (34 skipped, 780 total), 03156202
Finished: full tests pass on 03156202, the PR's last commit. PR https://github.com/radio-crestin/church-hub/pull/139 is mergeable, video and result in it.
- 2026-10-06: Program, song and Bible search results go through one shared component: clean text, only the searched words highlighted; e2e spec; full suite 746/746 green. PR #139 squash-merged.
