---
id: T-102
title: "Song discovery: read downloaded lyrics safely"
kind: task
level: normal
order: -5
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:00:00.000Z
---

## Goal
Found by search-security during T-100 (already on main); the user wants it fixed now (2026-10-06). Details, location and the suggested fix are only in the private note .claude/tasks-private/T-100-private-note.md ("Not in my area" item). Keep the details out of this file, commit messages and the PR. Done = fixed at the root, an e2e spec covers it, full e2e suite green.

## Notes

- 2026-10-06: Video: [T-102.mp4](../tasks_videos/T-102.mp4)
2026-10-06 (search-security): fixed at the root in song-discovery's lyrics diff (lyricsDiff.ts reads slide text from an inert DOMParser document). Branch fix/song-discovery-lyrics-text, commit 936a10f6.
- e2e: app/apps/client/e2e/song-discovery-lyrics-text.spec.ts; it failed on main (reproduced) and passes now; song-discovery.spec.ts still green.
- e2e: 741/741 green (34 skipped, 775 total), 936a10f6
- Video: Compare with normal lyrics, same before and after (proof nothing broke); no security effect shown.
PR: https://github.com/radio-crestin/church-hub/pull/144
- 2026-10-06: ### For the user
Links:
PR: [https://github.com/radio-crestin/church-hub/pull/144](https://github.com/radio-crestin/church-hub/pull/144)
Video: [T-102 before/after](https://github.com/user-attachments/assets/70344d86-8f3a-4abb-bb97-c3269e601d1c)
Question:
T-102 Song discovery: read downloaded lyrics safely
What changed: when you compare a downloaded song with one already in your library, the lyrics are now read in a safer way. The comparison looks and works exactly as before.
To try it: open the link and watch the video at the top. In the app: Cântări, Descarcă cântări, pick a song marked "Există ceva similar", press Compară.
https://github.com/radio-crestin/church-hub/pull/144
Is everything OK?
- 2026-10-06: Finished: full tests pass (741/741, 34 skipped, on 936a10f6, the PR's last commit; no commits since). PR https://github.com/radio-crestin/church-hub/pull/144 is mergeable, video in it.
- 2026-10-06: Song discovery's Compare reads downloaded lyrics from an inert document; looks the same; e2e spec added; full suite 741/741 green. PR #144 squash-merged.
