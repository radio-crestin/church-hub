---
id: T-129
title: "e2e: a search spec leaves the built-in category priorities at 4/3/2/1"
kind: task
level: normal
order: 15
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T21:19:13.983Z
---

## Goal
Found by the T-120 teammate (2026-10-06): after running the search specs, the test DB's four built-in categories have priorities 4/3/2/1 instead of all 1. One search spec sets them and doesn't restore them (T-126 fixed "can reorder categories" in search.spec; this is another one). Harmless since T-126's ranking change, but specs must leave the test DB as they found it: find it and restore in afterAll/afterEach.

## Notes

- 2026-10-07: 2026-10-07 Already fixed by T-126 (#164), no branch. Exactly 4/3/2/1 is what the old search.spec "can reorder categories" left behind: it reordered the 4 built-in categories and "restored" them with a 2nd reorder. T-126 made it restore each priority. It is the only spec that reorders categories (grep e2e for categories/reorder). Confirmed: after a full suite run on 2026-10-07 (812 passed), all four built-in categories are still at priority 1.
- 2026-10-07: Already fixed by T-126 (#164): after a full suite run the built-in category priorities stay at 1; the old reorder test was the only cause. No code change.
