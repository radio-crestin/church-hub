---
id: T-010
title: Marcaje standard Markdown — exact styles, same export/import, per-screen rendering
sprint: 2026-10-05
urgent: false
status: done
owner: marcaje
rolled: 0
order: 4
created: 2026-10-04
---
## Goal
Chat 16/08 BCEV: «ar fi utila o sectiune de bookmarks si pentru versete in care sa se memoreze inclusiv anotarile pe fiecare slide» + «deasemenea sa existe butoane de import/export ca si markdown/json»; 27/09 BCEV: «marcajele nu exporta si anotarile (sublinierile, etc.)», «in marcajele versetelor, sublinierea nu este salvata si afisata corect», «rendering-ul sublinierii nu e perfecta pe videoproiector»; 30/08 Iosif: «export-ul pare sa aiba propriul lui format.. nu este export-ul ca in programe (nu are id-ul cantarii, samd)». User 04/10: store marked songs/Bible verses as Markdown with the exact bold/underline/highlighted words; export/import that same format (with song id); every screen renders it independently and underline renders correctly from the Markdown; standardise. Today: styleRanges stored, export plain text without styles (bible-bookmarks/exportBookmarks.ts, song-bookmarks/exportBookmarks.ts).

## Notes
- 2026-10-05: 2026-10-05 done, waiting for review.
branch: feat/marcaje-standard-markdown
pr: #104 https://github.com/radio-crestin/church-hub/pull/104
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@f62bb6ca2438ef4a9fb9c1cc4e7cd0cbc12367d5/pr-demos-feat-marcaje-standard-markdown/t010-before.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@f62bb6ca2438ef4a9fb9c1cc4e7cd0cbc12367d5/pr-demos-feat-marcaje-standard-markdown/t010-after.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-104/church-hub-macos-arm64-pr-104-6f6d0c9.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-104/church-hub-windows-x64-pr-104-6f6d0c9.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-104/church-hub-linux-x64-pr-104-6f6d0c9.AppImage (6f6d0c9; the later commit 07328ccf only changes a test)
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a80d63c2ef959de28/.review-build/T-010/church-hub-T-010.app

What changed:
- Format: standard Markdown, i.e. CommonMark plus inline HTML: **bold**, *italic*, <u>underline</u>, <mark>highlight</mark> (another colour is written as <mark style="background-color:…">; ==x== is also read). Bible: "## Ioan 3:16 - RCCV" + styled verse. Songs: "## Title {#song-12}" + styled lyrics per slide ("### Label"). Notes: "> note".
- Storage: bible_bookmarks.markdown replaces style_ranges. A boot migration converts existing rows in one transaction, idempotent, then drops style_ranges. The API still returns styleRanges, parsed from the Markdown.
- Import: reads the Markdown and the old plain list. Styles are kept only when the text under the heading is exactly the verse; otherwise the verse is imported unstyled and reported as text_mismatch.
- Projector bug (root cause): style offsets were counted in each screen's own composed text. The Live Stream screen (includeReferenceInContent=true by default) puts "(Ioan 3:16) " first, so the marks moved 12 characters. Offsets are now anchored to the verse text: ScreenContent shifts them past the prefix, and the preview selection is counted inside [data-style-anchor].
- Also fixed: overlapping ranges produced crossed tags that dropped styles. The underline now scales with the font (0.07em thick, 0.14em offset) and runs through ş/ţ.
- Exports save as .md. i18n en/ro. OpenAPI updated, and the song export endpoint is now documented.

How to test: present a verse, underline a word in the preview, open the Live Stream screen: the same word is underlined. Bookmark it, export Marcaje (.md has <mark>/<u>/**), clear, import the file: the styles are back.

Tests: server bun test (codec, migration, parser, song export); vitest applyStylesToText; e2e bible-bookmarks, marcaje-styles-on-screens, song-bookmarks-markdown, panel-header-overflow, slide-style-overrides plus regressions. Full CI run started: https://github.com/radio-crestin/church-hub/actions/runs/37238339806

Not verified: underline look on the real projector/WebView; the migration on a real church database (only tested on test and in-memory DBs). Old bookmarks saved from a preview that prepended the reference stay shifted, because there is no way to tell them apart.
Also touched (told song-editor): slide-style-overrides spec, a race that now waits for <strong>; shared applyStylesToText (same output for non-overlapping runs).
Commits: 862b43c5, 59ece107, ca750976, 6f6d0c91 (merge main), 07328ccf.
- 2026-10-05: 2026-10-05 build at the current head 07328cc: https://github.com/radio-crestin/church-hub/releases/download/pr-build-104/church-hub-macos-arm64-pr-104-07328cc.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-104/church-hub-windows-x64-pr-104-07328cc.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-104/church-hub-linux-x64-pr-104-07328cc.AppImage
- 2026-10-05: Closed by the user. Marcaje stored/exported/imported as standard Markdown with exact styles; marks anchored to verse words (projector underline fix). PR #104 conflicted with main at close time; merging after the rebase.
- 2026-10-05: PR #104 merged as 5a4341c7 after the rebase on main (build b6ceb5a7, Romanian via Codex).
