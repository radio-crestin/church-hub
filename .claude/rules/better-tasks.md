# better-tasks: church-hub specifics
Where this project differs from the better-tasks plugin's own lead and teammate rules: its scripts, ports, review build and merge. Open when leading or working a better-tasks task. Everything not named here follows the plugin; the plugin's texts and `.claude/tasks/config.json` stay untouched, and the project-wide rules are in the root `CLAUDE.md`.

## Everyone
- **Plugin**: one user-scope install per machine (`claude plugin install better-tasks@better-tasks`), never a second `--scope project` copy, which goes stale; `.claude/settings.json` turns on its `autoUpdate`.
- **Ports 3000 (installed app) and 3001 (dev server)** are the user's: never start, test against or kill them. A task's worktree uses 3100 + n for its e2e and test build and 4100 + n for its review app (n = task number).
- **Temp files** go in your scratchpad, never the repo or `$TMPDIR`; delete them when done.

## Teammates
- **Branch**: `git switch -c feat/<slug>` (or `fix/<slug>`) first; push it under that name, not `task/T-xxx` (CLAUDE.md rule).
- **Task file**: it lives in the main checkout, outside your worktree: write your notes with `task_note`.
- **Your environment**: `bun app/scripts/worktree-setup.ts <task-id>` reuses the main checkout's caches and builds the client for your port. After client changes, rebuild it for that port: `cd app/apps/client && VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build`.
- **e2e**: always with `CI=1 TEST_PORT=<port>` (without `CI=1`, Playwright rebuilds the client for the default port): the single spec while you work, the full suite (command in the root `CLAUDE.md`) as the plugin's "full tests" after the user's yes. The before/after video runs against your port too; a Playwright recording needs `viewport` and `recordVideo.size` both `{ width: 1920, height: 1080 }`, or it comes out 800×600.
- **Playwright browser MISSING** while `playwright install` hangs at 100%: unzip the complete zip from `$TMPDIR/playwright-download-*/` into the reported folder and add an empty `INSTALLATION_COMPLETE` file.
- **Cargo** shares the main checkout's target dir: `cargo check` / `clippy` / `test` only, never `tauri build` / `dev` by hand.
- **Romanian texts**: have Codex propose each new or changed user-facing string (`codex exec -s read-only "<strings, where they appear, what they do>"`): short, natural church wording, correct diacritics (ă â î ș ț), no calques. Check it in context, then put it in `ro/`.
- **The build the user tries** is the review build: `bun app/scripts/review-build.ts <task-id>` builds the branch's desktop app for this OS into the main checkout's `.review-build/<task-id>/` (own port, data and identifier, no updater; it outlives the worktree) and prints its `file://` link. Rebuild after each push. The link goes in your notes as `app: <link>` and in the done block's "For the user" lines, under `PR:`.
- **Installers only when the user asks** (other OSes, another computer): `gh workflow run pr-build.yml -f pr=<n>` (or `-f platforms=macos,windows`); they land in the shared `pr-builds` prerelease, linked at the end of the PR description (keep its `<!-- pr-build:start/end -->` block when you rewrite the body). Links: `.claude/skills/detailed-pr/scripts/pr-build-links.sh <n> --wait`, noted as `build: <links>`. Don't wait for them otherwise.

## Lead
- **Finishing question** also gives the local app (the `app:` link); installer links only when the user asked for them.
- **Merge**: PRs have no GitHub checks (Actions run only before a release), so a PR is ready to merge once it has no unresolved review comments and no conflicts; anything open goes back to the owner. Main's branch protection needs `--admin` on the plugin's `gh pr merge --squash` (it passes branch protection, nothing else); then `git pull --ff-only` in the main checkout.
- **Cleanup** after the merge, from the main checkout, before you stop the teammate: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>`. It closes the review app, frees the task's ports, removes the worktree and review build, and deletes the branches and the PR's installers. A task with no PR still runs it, for its worktree and branch.
