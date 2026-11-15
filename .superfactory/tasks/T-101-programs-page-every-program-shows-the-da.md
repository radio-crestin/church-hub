---
id: T-101
title: 'Programs page: every program shows the date "21 ian. 1970"'
kind: task
level: normal
order: -4
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:00:00.000Z
---

## Goal
Found by programs during T-088 (already on main). On the Programe page (/schedules), every program card shows "21 ian. 1970" instead of its real date. Likely cause: createdAt is stored in seconds but ScheduleCard's formatDate reads it as milliseconds. Fix the root cause (check other places that read the same timestamps); the user wants it fixed now. Done = real dates on the cards, an e2e spec covers it, full e2e suite green.

## Notes

- 2026-10-06: Video: [T-101.mp4](../tasks_videos/T-101.mp4)
Done. Branch fix/programs-page-dates, commit 458c65dd. Root cause: the API sends program timestamps in Unix seconds (like its other timestamps); ScheduleCard read them as milliseconds. Fix: read as seconds (date part only). Other readers only sort by them. Spec: e2e/programs-page-dates.spec.ts.
e2e: 741/775 green (34 skipped, 0 failed), 458c65dd.
PR: https://github.com/radio-crestin/church-hub/pull/140
- 2026-10-06: Programe page cards show each program's real date instead of "21 ian. 1970" (seconds read as milliseconds); e2e spec added; full suite green. PR #140 merged.
