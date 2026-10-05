---
id: T-021
title: Add-song picker — category and tag filters
sprint: 2026-10-05
urgent: false
status: done
owner: song-picker
rolled: 0
order: -2
created: 2026-10-04
---
## Goal
Chat 13/06 Bogdan: «bug: când adaugi un nou program, și îți cere să adaugi o cântare, nu apar categoriile nici eticheltele». SongSearchPicker shows category and gama per row but has no category/tag filter. Add the same filters as the Songs page.

## Notes
- 2026-10-05: Done (2026-10-05), awaiting review.
branch: feat/song-picker-category-tag-filters
pr: #112 https://github.com/radio-crestin/church-hub/pull/112
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4bd37de30de19552f7e282f4bbf5af0401e1c6ff/pr-demos-feat-song-picker-category-tag-filters/song-picker-filters-before-.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@4bd37de30de19552f7e282f4bbf5af0401e1c6ff/pr-demos-feat-song-picker-category-tag-filters/song-picker-filters-after-.mp4
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a0db3f02fcdf87856/.review-build/T-021/church-hub-T-021.app
commits: a6a5eb5e (search API filters by tag), 598a0842 (shared SongCategoryFilter/SongTagFilter, Songs page uses them), fb4b98de (Escape in open multi-select closes only the dropdown, not the dialog), 48351650 (picker filters + spec song-picker-filters.spec.ts).
What changed: picker has category + tag dropdowns under the search box, applied in browse and search; browsed rows now show category; empty result offers "clear filters". Search API got tagIds (Songs page tag filter was silently ignored while typing — fixed too).
How to test: program > Adaugă > Cântare; uncheck a category, pick a tag, type a query.
Open question for user: category dropdown keeps the Songs page behavior (all checked, uncheck to hide). For a picker "pick one category" may be nicer; changing it would change the Songs page too.
Not verified: on real devices / CI installers (build links to follow).
Branch name note: feat/song-picker-filters already existed (empty, checked out in worktree agent-a9f8e3a7bd8cb2659), so I used a different name.
- 2026-10-05: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-112/church-hub-macos-arm64-pr-112-4835165.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-112/church-hub-windows-x64-pr-112-4835165.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-112/church-hub-linux-x64-pr-112-4835165.AppImage (commit 48351650)
- 2026-10-05: Add-song picker has category + tag filters (shared with Songs page); search API filters by tag. User kept the category filter's "all checked, uncheck to hide" behavior. PR #112 merged.
