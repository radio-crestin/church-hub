---
id: T-127
title: "Song categories: priority is interpolated into SQL in the category upsert"
kind: task
level: normal
order: -14
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T21:19:12.925Z
---

## Goal
Found by the T-126 teammate (2026-10-06) while fixing search ranking. Details are in the private note .claude/tasks-private/T-126-category-priority-sql.md (security finding: keep the write-up there, not in this file, the PR or commit messages). Fix it at the root with parameter binding / the ORM, validate input early, and cover it with an e2e case.

## Notes

- 2026-10-06: 2026-10-06 Done. Video: [T-127.mp4](../tasks_videos/T-127.mp4). PR: https://github.com/radio-crestin/church-hub/pull/165 (draft). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-127/church-hub-T-127.app (port 4227, own data). Commits 8890c136, e9482e5a on task/T-127 (off c100dc5b). Changed: the category update binds every value; POST /api/categories validates up front (validateCategoryInput.ts) and answers 400; reorder takes integer ids only; the form's priority input keeps whole numbers; OpenAPI updated. Checked: new category-save-validation.spec.ts fails 6/8 on main and passes 8/8 now; song-category-hidden, search and search-category-priority specs pass; edited a category's priority in Settings › Cântări and it saved. Not checked yet: the full suite (comes after the user's yes). The security details stay in the private note.

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/165
T-127 Song categories: a priority must be a whole number
Saving a category now checks its fields first. A priority that isn't a whole number is refused and the category stays as it was. Editing categories in Settings works as before.
- 2026-10-06: User (2026-10-06): accepted (Mark as resolved).
- 2026-10-07: 2026-10-07 Accepted. Rebased onto 9f1eefd6 (needed `bun install` for the new song-formats package). Full suite on a freshly seeded test DB (CI=1 TEST_PORT=3226, --workers=1 --retries=2): 812 passed, 34 skipped, 0 failed, 0 flaky. Earlier runs died: one when the disk filled, one mid-run; the leftover songs from the crash broke search-snippets-text, which is now T-131. PR #165 marked ready.
- 2026-10-07: Category save binds every value and validates input first (bad input → 400); settings priority field accepts whole numbers only. Merged PR #165.
