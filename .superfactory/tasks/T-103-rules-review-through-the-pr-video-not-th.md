---
id: T-103
title: "Rules: review through the PR + video, not the local build"
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
The user (2026-10-06): "don't tell me to install the build.. always follow better-tasks and create a pr with a video, if i want to install the build i will tell you and you will open it directly for me". They asked to change .claude/rules/better-tasks.md to match. Change the Lead "Finishing question" line: the review question carries the full PR URL and the 1080p before/after video, never the local app link; the lead opens the local app (`open <.review-build/...app>`) only when the user asks. Teammates still build the local app (so the lead can open it on request) and open the PR + video before reporting done; adjust the Teammates lines that say otherwise (e.g. the `app:` line no longer goes into the user's question). Keep the file's style (keywords, short lines). Tooling only: no e2e spec needed; commit on its own branch with a PR (no video needed for a docs change).

## Notes

- 2026-10-06: Done: rules updated (Finishing question = PR URL + 1080p video, never local app; lead opens local build only on request; teammates open PR + video before done). PR: https://github.com/radio-crestin/church-hub/pull/137. Docs only: no e2e, no video. Not merged.
- 2026-10-06: User on PR #137 (2026-10-06): "but i don't see the pr created using better-tasks instructions.. and also where is the video?" → Redo the PR description per the better-tasks pull-request skill (its template, Video line) and make a before/after video per the better-tasks video skill, even though it is a docs change. Update PR #137, don't open a new one.
- 2026-10-06: PR #137 description rewritten to the better-tasks template (Asked for / Why / What changed / To test / Notes / Commits), title "T-103 ...". No video: docs-only rules change, nothing on screen. PR: https://github.com/radio-crestin/church-hub/pull/137. Ready for review, not merged.
- 2026-10-06: Video: [T-103.mp4](../tasks_videos/T-103.mp4) - before/after of the rule text and the lead's review question; attached to PR #137 (poster opens it with sound). PR: https://github.com/radio-crestin/church-hub/pull/137. Ready for review, not merged.
- 2026-10-06: Project rules: review through the PR + before/after video, never the local build; the lead opens the build only when the user asks. PR #137 merged.
