---
id: T-106
title: "Rules: remove every church-hub rule that contradicts better-tasks"
kind: task
level: normal
order: -8
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T00:00:00.000Z
---

## Goal
The user (2026-10-06): "remove your custom instructions and if better-tasks has bad instructions tell this to that agent", then chose to remove both the lead's memory note and the T-103 change. better-tasks is fixing the same behavior in the plugin itself (its T-051: PR + video before the question, no local-build step, no browser open at merge, a video on every PR). So revert T-103's change to .claude/rules/better-tasks.md (commit b4562995, merged in 7ffdbac0) with `git revert`; touch nothing else in that file. Branch, PR per the project rules, with a video like every PR.

## Notes

- 2026-10-06: Video: [T-106.mp4](../tasks_videos/T-106.mp4) (poster+video: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@e3a7c070c16a11e290071d2db511eae61c5a1f92/T-106.mp4). PR: https://github.com/radio-crestin/church-hub/pull/141 . Branch chore/undo-review-flow-rules, commit 6ae1ac51 = clean `git revert b4562995`; file now identical to pre-T-103 (diff vs b4562995~1 empty). Docs only: no app build, no e2e.
- 2026-10-06: User (2026-10-06): "remove everything from your memory or custom instructions which contradicts with better-tasks instructions". Scope grows: besides the T-103 revert, remove from .claude/rules/better-tasks.md every line that contradicts the better-tasks plugin's own lead/teammate rules (read them in the installed plugin). Candidates the lead saw: "Green before asking" (plugin: full tests come after the user accepts); "Merge with --merge --admin instead of --squash --delete-branch" (keep only the fact that main's ruleset needs --admin, if the plugin's merge command fails without it); teammates' "Full e2e before done" (same as Green before asking); "PR body: the detailed-pr skill's sections" (plugin has its own PR template). Keep lines that only add project facts (ports, worktree setup, review build, cleanup, Romanian via Codex, installers on request, private notes). Add the commits to PR #141 and redo its video; report done.
- 2026-10-06: Bigger scope done: commit 2c771cf7 on PR #141 removes Green before asking, teammates' Full e2e before done (kept the suite command as "Full tests (at the finish)"), the e2e re-check in Before merging, the own merge style (kept only: main needs --admin), --quality high in Video, and PR body via detailed-pr. Project facts kept. New video: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@9eb9f6843f14d259660c4d581d3dcea5251930a3/T-106.mp4 . PR body updated. Docs only.
- 2026-10-06: Commits 6ae1ac51 (revert T-103) + 2c771cf7 (drop rules contradicting the plugin) on PR #141. No local build: rules text only. Not verified: nothing to run.

### For the user
Links:
PR with video: [https://github.com/radio-crestin/church-hub/pull/141](https://github.com/radio-crestin/church-hub/pull/141)
Question:
T-106 Remove the project rules that go against better-tasks
What changed: the review-flow lines from T-103 are undone, and the rules that fought better-tasks are gone (tests before your review, own merge style, high video quality, own PR layout). Project facts stay.
To try it: open the link and watch the short video, or read the changed file.
https://github.com/radio-crestin/church-hub/pull/141
Is everything OK?
- 2026-10-06: Finished: docs only (one rules file), so no e2e suite run; PR #141 has the video and is up to date.
- 2026-10-06: .claude/rules/better-tasks.md: T-103 reverted and every rule that contradicted the better-tasks plugin removed (tests before review, own merge style, video quality, detailed-pr layout); project facts kept. PR #141 merged.
