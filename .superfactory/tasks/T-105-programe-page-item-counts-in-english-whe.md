---
id: T-105
title: "Programe page: item counts in English when the app is in Romanian"
kind: task
level: normal
order: -7
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:45:24.290Z
---

## Goal
Found by programs during T-101; the user wants it fixed now (2026-10-06). On the Programe page (/schedules), with the app in Romanian, program cards show the item count in English ("0 items", "2 items"); only "1 element" is translated. Fix the plural forms (Romanian has one/few/other) in the i18n files, check other counts on that page. Done = correct Romanian for 0, 1, 2, 20+ items, e2e spec, PR with the 1080p before/after video, full e2e green.

## Notes

- 2026-10-06: Scope (lead, 2026-10-06): include the same Romanian plural gap in the 7 other keys programs found (bible search.resultsCount; settings categories/tags/backup counts; songs picker.loadedCount, editAsText.preview, versions.count), so no count falls back to English anywhere.
- 2026-10-06: Video: [T-105.mp4](../tasks_videos/T-105.mp4)
Done. Branch fix/ro-program-counts, commits 366f06a5, a1a43f16. Root cause: Romanian plurals are one/few/other; the ro files had only _one/_other, so 0 and 2-19 fell back to English. Added _few (= old plural) and "de" in _other (20+) for all 21 ro keys (schedules 14, bible 1, settings 3, songs 3). Spec e2e/programs-page-ro-counts.spec.ts: cards for 0/1/2/20 + a guard that every ro plural has _few. Full suite after acceptance.
PR: https://github.com/radio-crestin/church-hub/pull/145
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-105/church-hub-T-105.app

### For the user
Links:
Local build: [file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-105/church-hub-T-105.app](file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-105/church-hub-T-105.app)
Question:
T-105 Romanian item counts
What changed: in Romanian, counts no longer switch to English. The Programe page now says "0 elemente", "2 elemente", "20 de elemente". The same fix covers song, Bible and settings counts.
To try it: open the app in Romanian and go to Programe.
file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-105/church-hub-T-105.app
Is everything OK?
- 2026-10-06: Finished: full tests pass. e2e: 745/780 green (34 skipped, 1 flaky on retry: song-text-mode-scroll, unrelated), ae13ffbb. Main merged in; two older specs (bible.spec results count, songs-api-pagination uncategorized card) adjusted to accept "N de ..." for 20+. PR #145 updated.
- 2026-10-06: All 21 Romanian counts get the "few" plural form (no more English fallback for 0 and 2–19); spec guards it; full suite 745/780 green. PR #145 squash-merged.
