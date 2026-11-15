---
id: T-104
title: "Songs: remove <i>, <b> and similar formatting tags from all songs and from the Resurse Creștine import"
kind: task
level: normal
order: -6
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:00:00.000Z
---

## Goal
User (2026-10-06), reviewing T-100's PR #139, with a screenshot of a song search result that now shows the title as "<i>Cântare</i> nouă" (the tags appear as literal text since T-100 shows search text as plain text): "also, make sure to cleanup <i> and <b> and other formattings like this from all the songs.. do it like a migration as for now we don't want it.. also from resurse crestine make sure to apply this filter, if the user adds them, this is separate..". So: (1) a one-time database migration that strips <i>, <b> and similar inline formatting tags from all existing songs (titles, lyrics/slides and any other song text fields), keeping the text; (2) the Resurse Creștine import strips them too, so new imports come in clean. Formatting a user adds themselves is out of scope here ("this is separate"). Check the migration against the sync setup (other devices / cloud copies) and entity cases like &amp;. Done = migration + import filter, e2e spec covering both, PR with the 1080p before/after video, full e2e green.

## Notes

- 2026-10-06: User (2026-10-06): "i want clear text inside the imported songs as i told you last time" — T-100 (PR #139) is held until this lands; search results must show clean text, no literal <b>/<i>. Priority: this unblocks T-100.
- 2026-10-06: Video: [T-104.mp4](../tasks_videos/T-104.mp4)
(song-cleanup): done, waiting for the user's review on the PR. Branch fix/strip-song-formatting-tags.
- What changed: one-time start-up migration strip_song_formatting_tags_v1 (app/apps/server/src/db/migrations/strip-song-formatting-tags.ts) removes b/i/u/s/em/strong/span/font/sup/sub/mark/... from song titles, alternate titles, metadata, slides (content/label/notes) and song-group titles; keeps the words, <p>/<br> and entities like &amp;; catches real markup and escaped text (&lt;i&gt;, &amp;lt;b&amp;gt;). Refreshes the search index for changed songs.
- Sync: runs after add_sync, so cleaned songs get a new updated_at and are queued for the library sync (cloud + other devices get clean text, last writer wins). Clean songs untouched (checked in e2e).
- Import: OpenSong parser (used by Resurse Creștine discovery + one-shot import) strips them from title, metadata and lyrics (app/apps/client/src/features/song-import/utils/parseOpenSong.ts). Editor formatting the user adds: untouched, as asked.
- Decision to flag: the migration also removes real bold/italic markup in slides (not only tags shown as text), per "we don't want it for now".
- Today's Resurse Creștine catalog has no such tags (checked the 24,608 files); the filter guards future ones.
- Test: e2e/song-formatting-tags.spec.ts (migration on a restarted server + RC import via discovery): green. Full suite running now.
- Commits: f08f6a0e, f5d2698c, 714871a2.
PR: https://github.com/radio-crestin/church-hub/pull/142
- 2026-10-06: User decision (2026-10-06): "Yes, remove all": the migration also removes real bold/italic in slides; all songs become plain text.
- 2026-10-06: (song-cleanup): user confirmed "remove all": the migration removing real bold/italic too stays as is.

### For the user
Question:
T-104 Songs: remove <i>, <b> and similar formatting tags
What changed: when the app updates, it cleans every song once: tags like <i> and <b> disappear from titles and lyrics, the words stay. Songs from Resurse Creștine also come in clean from now on.
To try it: open the pull request and watch the short before/after video, then search for a song in Cântări and open it: no tags in the title or the slides.
https://github.com/radio-crestin/church-hub/pull/142
Is everything OK?
- 2026-10-06: e2e: 742/742 green (34 skipped, 776 total), 714871a2
Finished: full tests pass. PR https://github.com/radio-crestin/church-hub/pull/142 with the video. My test server on 3204 is stopped; no local build left running.
- 2026-10-06: One-time migration strips <i>/<b>/span/etc. from every song (titles, metadata, slides; also real bold/italic, as the user chose); cleaned songs sync; Resurse Creștine import strips them too; e2e spec; full suite 742/742 green. PR #142 squash-merged.
