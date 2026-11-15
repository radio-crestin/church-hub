---
id: T-109
title: Prompt audit of the project's agent instructions (CLAUDE.md, rules, skills, agents)
kind: task
level: normal
order: -3
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-06T00:00:00.000Z
updatedAt: 2026-10-06T11:27:08.568Z
---

## Goal
The user ran `/claude-api prompt-audit` (bare subcommand, no prose) in the main checkout on 2026-10-06.

What that asks for: execute the guide at
`/private/tmp/claude-501/bundled-skills/2.1.291/96f9737266a0a3fa75694832a4bea73e/claude-api/shared/prompt-audit.md`
in order (Step 0 → Step 6). Read it first and follow it, do not summarize it. It is non-interactive: state assumptions in the report, don't stop to ask.

Deliverables (both, always):
1. The audit report: each finding with `file:line`, quoted evidence, pattern (group/row), why obsolete, confidence, action. Ordered by confidence; summary + counts per group at top.
2. A proposed diff (unified diff, one finding per hunk), for high/medium findings only.

The request did NOT ask to apply edits: propose only, change no project files. So no branch, no PR, no video, no review build for this task — it is report-only. Write both deliverables to `.claude/tasks-private/prompt-audit-2026-10-06.md` (gitignored), and the proposed diff also as `.claude/tasks-private/prompt-audit-2026-10-06.diff`; put their paths in a task note.

Step 0 assumptions already decided by the lead (state them in the report):
- Scope: the project's prompt surface in this repo — root `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/`, `.claude/skills/` (incl. reference files), `.claude/agents/`, `.claude/commands/` if present, nested CLAUDE.md/AGENTS.md outside node_modules/target, plus any application code that builds prompts for an LLM (e.g. the request-a-feature worker, live translate). Do NOT read `.claude/settings*.json`, `.mcp.json`, hook configs or credentials. User-level files (`~/.claude/CLAUDE.md`, `~/.claude/rules/`) and the better-tasks plugin's own injected rules are out of scope: list them as skipped.
- Target model: Claude Opus 5.5 (`claude-opus-5-5`) for the agent configuration files (the model running Claude Code here), unless a file pins its own model (then that one). For application code, the model it calls; if it calls a non-Anthropic provider (Gemini etc.), record that in the assumptions and audit only the prompt text, never propose switching provider.
- Pay particular attention to Group 2: stale paths/commands (check they exist by reading, never by running them), and contradictions between instruction files (e.g. root CLAUDE.md vs `.claude/rules/better-tasks.md` vs skills), ordered by `git blame`.

Report done with a task note when both files are written; no finishing PR flow.

## Notes

- 2026-10-06: User, mid-setup (verbatim): "check, simplify the tasks loop and everythign, just highlight the general principles and let the agent to do the things by itself the best way adapted to the context".

This changes the task: no longer report-only. Apply the simplification: rewrite the project's instruction files (root CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*, skills, agents — the better-tasks loop rules in `.claude/rules/better-tasks.md` above all) down to the general principles and the facts only this project knows (ports, cross-platform constraints, commit/no-coauthor rule, release gate, i18n, Playwright-not-Tauri…), and drop step-by-step choreography, repeated rules and shouting, leaving the agent to choose the method that fits the context. Keep the audit report as the record of why each cut was made. Group-2 conflict/stale-fact edits and anything that loosens a safety rule (commit attribution, ports 3000/3001, secrets, no destructive git) stay flagged for the user, not applied.
Now it changes project files: work on branch `chore/simplify-agent-instructions` in a worktree, draft PR with the diff + report summary. No before/after video (no app change). The better-tasks plugin's own texts are handled separately by the lead (contribute flow), not in this task.
- 2026-10-06: User confirmed: "the tasks loop" means this project's files only (`.claude/rules/better-tasks.md` and the rest of church-hub's instruction files), not the better-tasks plugin's own texts.
- 2026-10-06: User sent this (typed in the teammate's view, confirmed to the lead): "make sure to also audit the docs handoff and every claude.md and the entir eprocess end to end". The scope now includes docs/, the handoff, every CLAUDE.md and the whole task process end to end. The plugin's texts are read-only: findings about them are flagged, not edited. The user says they did not send "don't do it in worktrees..", so that one is ignored.
- 2026-10-06: User (verbatim): "if you overrided betetr-tasks behaviour, then update the overrides..".
Meaning: wherever the project's files change or override better-tasks' behaviour (mainly `.claude/rules/better-tasks.md`, plus any better-tasks lines in CLAUDE.md, skills or docs), bring each override up to date with the installed plugin (0.11.8, just updated: ~/.claude/plugins/cache/better-tasks/better-tasks/0.11.8/). Keep only the real project-specific differences, each stated once as a principle. Drop overrides the plugin now covers, and fix any that contradict its current flow. The plugin's own files stay read-only.
- 2026-10-06: User, typed in the teammate's view (as the teammate relayed it): "make sure to remove dupliacte content, keep it once.. fix conflicting.. try to remove the details if they are not needed, highlight only the general guidelines". Taken as lifting the "Group-2 fixes proposed only" limit: the verified stale-fact and conflict fixes and the dedup pass are applied on the branch, and the user reviews them in the PR. Safety rules keep their substance, each stated once. Still open: F1, the task branch name. Plugin 0.11.8's task_pr.py pushes task/<id>, but worktree-cleanup.ts finds the PR by the local branch, so the override stays until that's decided.
- 2026-10-06: User decisions:
1. Branch name: "use the default from the better-tasks". Drop the feat/<slug> / fix/<slug> override for task branches, in `.claude/rules/better-tasks.md` and the root CLAUDE.md branch rule; task branches follow the plugin's task/<id>. Check that app/scripts/worktree-cleanup.ts (and review-build/worktree-setup, if they assume a name) still find the branch and PR under task/<id>; fix them in this task if not.
2. Report copy: "No, PR is enough". Don't copy the report into the main checkout; put its summary (findings + what was cut and why) in the PR description.
- 2026-10-06: Done (teammate, worktree agent-a7d46caa84e2d08e4, local branch chore/simplify-agent-instructions, pushed by task_pr.py as task/T-109). 9 commits, 70d50636..d715be9d.

What changed, in short:
- Root CLAUDE.md is down from 126 lines to 43: principles first, then this project's facts, each rule once.
- .claude/rules/better-tasks.md keeps only the real differences from plugin 0.11.8: review build = the build the user tries (app: line), no GitHub checks so merge on no open comments and no conflicts, --admin on squash, cleanup.
- Task branches follow the plugin (task/<id>), as the user decided.
- .claude/CLAUDE.md is removed (it was a duplicate).
- The release-smoke-check skill is removed: superseded, and it defaulted to port 3000.
- Stale facts fixed: --warm-up-coremidi, app/ paths, i18n counts, the Worktrees section, /tmp, the cwd line.
- detailed-pr and both agents are simplified.
- app/scripts/worktree-cleanup.ts + cleanup-github.ts now find the PR under task/<id> and delete its head branch. Probed read-only: task/T-109 finds PR #150, and its headRefOid equals the local HEAD.

The audit summary is in the PR description, as the user asked; there is no separate report file.

Not checked:
- No e2e covers cleanup, and the cleanup itself has not run. It runs at merge time.
- The full suite has not run (no app change; it comes after the yes).
- No video and no review build (no app change).
- graphify update was not run in the worktree.

Left for the user (in the PR):
- The /commit skill that CLAUDE.md names is not in the project.
- The live-translation prompts (Gemini/OpenAI) are left alone.
- docs/pr-description-guide.md is kept as a human doc.

Lead: a stale copy of prompt-audit-2026-10-06.diff sits in the main checkout's .claude/tasks-private/. I wrote it before the isolation guard stopped me; it can be deleted.

PR: https://github.com/radio-crestin/church-hub/pull/150

### For the user
PR: https://github.com/radio-crestin/church-hub/pull/150
T-109 Prompt audit of the project's agent instructions
The agent instructions are cut to principles and project facts, each rule said once. Stale and conflicting lines are fixed, and task branches now follow better-tasks (task/<id>), with cleanup updated to match.
- 2026-10-06: Finished: full e2e suite locally and serially (CI=1 TEST_PORT=3209, --workers=1 --retries=2): 755 passed, 34 skipped, 1 flaky that passed on retry (program-page-follows-live-slide.spec.ts:131, unrelated). PR #150 marked ready, description updated with the result. No GitHub checks to wait for. Merge note for the lead: this is the first task/<id> PR, so after merging, worktree-cleanup.ts T-109 should find it under task/T-109 and delete that remote branch; worth a glance at its step log.
- 2026-10-06: Merged PR #150. The project's agent instructions are cut to principles and project facts, each rule said once. Stale and conflicting lines are fixed. .claude/CLAUDE.md and the release-smoke-check skill are removed. Task branches follow better-tasks (task/<id>), and worktree-cleanup.ts handles that: its first real run deleted origin/task/T-109. Full e2e: 755 passed, 1 flaky that passed on retry.
