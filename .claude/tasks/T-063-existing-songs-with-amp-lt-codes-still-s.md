---
id: T-063
title: Existing songs with &amp; / &lt; codes still show correctly after the decode fix
sprint: 2026-09-28
urgent: false
status: done
owner: security-code
rolled: 0
order: -18
created: 2026-10-04
---
## Goal
User 2026-10-04, about merged PR #89 (decodeHtmlEntities now decodes once instead of twice): "make sure ... you convert the ampersand and so on so that they are rendered correctly after the fix" — meaning existing songs and slides saved with codes like &amp;, &lt;, &gt;, &quot;, &#39;, &nbsp; (incl. double-encoded ones like &amp;amp; / &amp;lt; from old imports) must still show "&", "<", etc. correctly on the projector, slide list, LivePreview, exports and search.
Do: query a copy of the real database (~/Library/Application Support/church-hub/app.db — copy it, never write to the original) for stored text containing entities; count by pattern and source (imports, editor). If old data relied on the double decode, convert it with a one-time, idempotent migration (and fix the import path so new data is stored the same way); otherwise prove it already renders right. e2e/unit test with real examples. Before video: a real song with & or < showing wrong on main after #89; after: shown correctly.

## Notes
- 2026-10-04: 2026-10-04 security-code
branch: fix/entity-decode-previews
pr: #91 https://github.com/radio-crestin/church-hub/pull/91
before: none — not reproducible: no song shows wrong on main
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@82a0f52e74c9c54d9935f38777192c425457f900/pr-demos-fix-entity-decode-previews/T-063-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-91/church-hub-macos-arm64-pr-91-5111030.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-91/church-hub-windows-x64-pr-91-5111030.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-91/church-hub-linux-x64-pr-91-5111030.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a72e97c5fd9ca757a/.review-build/63/church-hub-63.app (port 4163)
Findings (db COPY, read-only): 7,097/146,728 slides have entities (&#039; 6,412, &quot; 4,009, &gt; 34, &lt; 32), 0 double-encoded; other tables none; fixture same. All 146,728 slides: pre-#89 vs current converters → 0 differences. Importers + editor escape once → no migration, no import change. PR = tests only (commit 51110304): unit normalizeText + import round-trip, e2e stored-entities (projection, next strip, slide list, search) 4 passed. PR CI green on 3 OSes. Note: SlidePreview, ScheduleItemList/Song/Slide, calculateNextSlideData are unused code (cleanup candidate).
- 2026-10-04: Real DB copy: 0 double-encoded slides; all 146,728 slides render identically before/after #89 — no migration needed. PR #91 adds tests from real rows (merging when CI is green).

## PR
- branch:
- pr:
- video:
