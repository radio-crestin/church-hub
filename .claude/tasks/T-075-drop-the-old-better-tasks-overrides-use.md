---
id: T-075
title: Drop the old better-tasks overrides; use the plugin's official instructions (Kokoro voice)
sprint: 2026-10-05
urgent: false
status: done
owner: tasks-tooling-2
rolled: 0
order: -6
created: 2026-10-05
---
## Goal
User 2026-10-05: «make sure to remove the old better-tasks instructions override and use the official instructions, the one generating the voice using that model».
Today .claude/tasks/coordinator.md and teammate.md are project overrides. Their video step uses macOS `say` (teammate.md step 4). The official plugin (~/.claude/plugins/marketplaces/better-tasks, latest cache version) narrates demo videos with Kokoro TTS (see its T-011, hooks/demovideo.ts, bin/kokoro-setup.sh).
Do: remove the overrides so the plugin's official coordinator and teammate instructions apply, with Kokoro narration. Before deleting, compare them with the official ones. Project-only rules the official version lacks (worktree-cleanup.ts step, Romanian texts from Codex, e2e port/worktree gotchas, no AI co-author, upload-demos/jsDelivr links) must not be lost silently: move what's still needed to wherever the plugin expects project additions (e.g. tips.md or CLAUDE.md), and list in the notes what was kept and what was dropped. Make sure the Kokoro voice is set up and works (the "Before/after videos" setting is on, voice ready). Commit on main (tooling, no PR needed). Teammates already running keep their current flow.

## Notes
- 2026-10-05: Done (tasks-tooling). Commit 8f996ccd on branch worktree-agent-a21f6efc8262b1721 (based on main 6c7119b9). To land on main, from the main checkout: `git merge --ff-only worktree-agent-a21f6efc8262b1721`. The settings only apply after that.
What changed:
- config.json: turned on the plugin's own `"demoVideos": true` (Kokoro-narrated before/after video via its bin/demo-video.sh) and `"pullRequests": true` (PR per task, video added with `gh pr create --attach`). `worktree: true` stays.
- teammate.md / coordinator.md: the old replacement flow is gone. Each is now an `<!-- extend -->` file with a short "church-hub specifics" list added after the plugin's official text.
- task-template.md: back to the shipped template (no `## PR` section; the PR: and Video: lines now go in Notes, as the plugin expects).
Kept (as project additions): feat/ and fix/ branch names (a CLAUDE.md rule, used instead of task/T-xxx); worktree-setup.ts and port 3100+n; never use port 3000, run e2e with CI=1 TEST_PORT; shared Cargo target; the Playwright MISSING workaround; Romanian texts via Codex; e2e spec with --workers=1 --retries=2; detailed-pr for the PR body; review-build.ts local app; pr-build-links.sh installers; notes via task_note from a worktree; temp files in the scratchpad; merging with `--merge --admin` (instead of the plugin's --squash) then `git pull --ff-only`; worktree-cleanup.ts after a merge (lead).
Dropped (the plugin now handles these): the macOS `say` voice, record-features.sh, the _demo spec with installDemoOverlay and highlight, upload-demos.sh with jsDelivr/GIF links, the before/after table rules, and the old Accept-preview wording. No-AI-co-author is not repeated here: root CLAUDE.md, the commit-no-coauthor skill and the hooks already enforce it.
Kokoro: installed with the plugin's bin/kokoro-setup.sh into ~/.local/share/better-tasks/kokoro (`.ready` is there). Tested with a two-step image spec: a 9 s mp4 with narration (audio max -4 dB). Output was in the scratchpad, not the project.
How to check: (1) `ls ~/.local/share/better-tasks/kokoro/.ready`; (2) /better-tasks config shows Before/after videos on and PR per task on; (3) a teammate spawned after the merge gets the "Before/after video (on in this project)" and "Pull request per task" sections plus "church-hub specifics" in its prompt.
Not checked: an actual teammate spawn with the new text (it needs the merge to main and a new spawn); a real PR with --attach (gh 2.102 is installed, so it should work).
- 2026-10-05: User 2026-10-05, after 8f996ccd was made: «now i've updated it..» (the better-tasks plugin was updated). Re-check against the newly installed plugin version. Also: the user asked to remove the overrides and use the official instructions; copying the official text into project coordinator.md/teammate.md is still an override that will drift on the next plugin update. Keep only the church-hub additions in whatever place the plugin merges with its own instructions (not replaces); if the plugin has no such place, say so in the notes.
- 2026-10-05: Re-check after the plugin update (tasks-tooling). The update the user made is 0.7.0 itself: installed_plugins.json was last changed at 13:06, and the project entry points to cache 0.7.0, which is the same as the marketplace copy (hooks and bin compared, no differences). 8f996ccd was already compared against this version. Nothing newer exists.
No official text is copied into the project files. The plugin has a merge place: a file in .claude/tasks/ whose first line is `<!-- extend -->` gets its body ADDED after the shipped text (hooks/texts.ts resolveText); HTML comments are stripped and never reach the model. coordinator.md and teammate.md now hold only that line, one comment line and the "church-hub specifics" list. A plugin update changes the official text with no drift.
New commit a3ba8295: deleted task-template.md and tips.md. They held only the shipped text inside a comment, a copy that would drift; without the files the plugin uses its own text.
Commits to merge: 8f996ccd, a3ba8295 (branch worktree-agent-a21f6efc8262b1721, fast-forward from main 6c7119b9).
- 2026-10-05: Project coordinator.md/teammate.md now extend (not replace) the plugin's instructions with a short church-hub list; plugin demo videos (Kokoro voice) and PR-per-task on; stale task-template.md/tips.md removed. Landed on main.
- 2026-10-05: User 2026-10-05 (reopened): «make sure to not override it.. let the plugin have their own configs and you extend it separately.. with a claude.md file or something like this». The `<!-- extend -->` coordinator.md/teammate.md in .claude/tasks/ still count as overriding the plugin's files. Do: delete .claude/tasks/coordinator.md and teammate.md so the plugin's own texts apply untouched; move the church-hub specifics (incl. the pr-builds installer rule from T-077) into a separate file Claude loads on its own, e.g. a "better-tasks: church-hub specifics" section in CLAUDE.md or .claude/rules/better-tasks.md (lead and teammates both read it). Keep config.json (plugin settings). Check nothing else references the deleted files (worktree-cleanup.ts, documented-pr skill, other docs). Commit on main.
- 2026-10-05: Done (reopen ask). Commit 8013da5c, pushed to origin/main. Deleted .claude/tasks/coordinator.md and teammate.md, so the plugin's own texts apply untouched. config.json kept. The church-hub rules now live in .claude/rules/better-tasks.md (Claude Code loads it by itself for the lead and for teammates), in two sections: Lead and Teammates. The pr-builds installer rule is in there. Updated the files that pointed at the deleted ones: app/scripts/worktree-setup.ts, app/apps/client/.gitignore, .claude/skills/documented-pr/SKILL.md. Old task files (T-052/53/54) still name them as history; left as is. How to check: `ls .claude/tasks` shows no coordinator.md/teammate.md; a newly spawned teammate gets the plugin text plus the rules file. Not checked: a fresh spawn. The main checkout needs `git pull --ff-only`: I made the commit in my worktree because worktree isolation blocked edits in the main checkout.
- 2026-10-05: Plugin files no longer overridden: .claude/tasks/coordinator.md and teammate.md deleted; church-hub rules moved to .claude/rules/better-tasks.md (loaded for lead and teammates). Pushed to main.

## PR
- branch:
- pr:
- video:
