---
id: T-053
title: Demo videos highlight the bug or new feature with red boxes and arrows
sprint: 2026-09-28
urgent: true
status: doing
owner: demo-recording
rolled: 0
order: -11
created: 2026-10-04
---
## Goal
User (2026-10-04, while reviewing T-019): "make sure to highlight with some red rectangles or arrows the bugs or the new features, helping the user see them easier.. do this in the skill and also for the existing and future tasks".
Done when:
- e2e/helpers/demo-recording.ts has a helper to draw a red rectangle around an element (and an arrow pointing at it), with an optional short label, removable after a step; used together with showCaption.
- The documented-pr skill and .claude/tasks/teammate.md step 4 say: every before/after video highlights the bug (before) and the fix/new feature (after) with it.
- Committed on main and pushed, so feature branches can rebase on it.
- Then every open task's videos are re-recorded with highlights by its owner (T-019, T-020, T-036, T-040, T-012, T-023, plus T-026, T-015, T-024 when they record).

## Notes
- 2026-10-04: Done, commit 0e09e9c0 on main (pushed to origin/main). Helper in e2e/helpers/demo-recording.ts: highlight(page, locator, label?) draws a red box around the element and a red arrow from a short label; clearHighlights(page) removes them all. The label is placed diagonally, never in the caption band. If the element is in the bottom 200px, the caption moves to the top until clearHighlights. Usage: await highlight(page, saveButton, 'Fixed: saves the title'); await showCaption(page, 'After: ...', 2500); await clearHighlights(page). Docs: documented-pr SKILL.md (default #6, template, guideline) and teammate.md step 4 (Highlight bullet). Verified: a throwaway spec recorded on port 3153 (scratchpad demos/highlight-demo.mp4). A frame of the mp4 shows box, arrow and label clearly; the caption stays at the bottom for a top element and moves to the top for a bottom element; nothing is covered. Biome and tsc are clean. Not verified: the WebKit project, and very large elements. Not done: the main checkout's local main was not fast-forwarded (it has uncommitted task files); teammates rebase on origin/main.

## PR
- branch:
- pr:
- video:
