# better-tasks: church-hub specifics
Project additions to the better-tasks plugin's own coordinator and teammate rules; the plugin's texts and `.claude/tasks/config.json` stay untouched. Open when leading or working a better-tasks task.

## Lead (coordinator)
- **Finishing question** also lists, each on its own line, the local app (`app:` file:// link) and the installers (`build:`) from the task's notes.
- **Green before asking**: ask the user to test or approve a task only when every check on its PR is green (`gh pr checks <n>`).
- **Before merging**: check again: every check green, no unresolved review comments, no conflicts. Anything red or open goes back to the owner to fix; never merge over a red check (`--admin` passes branch protection rules, not red CI).
- **Merge** with `gh pr merge <n> --merge --admin` instead of `--squash --delete-branch`: keeps the granular commits; `--admin` passes branch protection. Then `git pull --ff-only` in the main checkout.
- **Cleanup** after the merge, from the main checkout: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>`, then stop the teammate. It closes the review app, frees ports 3100 + n and 4100 + n (never 3000), removes the worktree and review build, and deletes the branches and the `pr-build-<n>` release once merged. A task with no PR (tooling) still runs it for its worktree and branch.

## Teammates
- **Branch**: `git switch -c feat/<slug>` (or `fix/<slug>`) first; push it under that name, not `task/T-xxx` (CLAUDE.md rule).
- **Setup**: `bun app/scripts/worktree-setup.ts <task-id>` (~5 s): reuses the main checkout's caches, builds the client for your port = 3100 + task number. After client changes: `cd app/apps/client && VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build`.
- **Port 3000** is the user's dev server: never start, test against or kill it. e2e always with `CI=1 TEST_PORT=<port>` (without `CI=1`, Playwright rebuilds the client for port 3000). The before/after video's steps run against your port too.
- **Cargo** shares the main checkout's target dir: `cargo check`/`clippy`/`test` only; no `tauri build`/`dev` by hand, except `review-build.ts` (below).
- **Playwright browser MISSING** and `playwright install` hangs at 100%: unzip its complete zip from `$TMPDIR/playwright-download-*/` into the reported folder and add an empty `INSTALLATION_COMPLETE` file.
- **Romanian texts via Codex**: for each new or changed user-facing string, `codex exec -s read-only "<strings + where they appear + what they do>"`; ask for short, natural church wording with correct diacritics (ă â î ș ț), no calques. Check it in context, put it in `ro/`.
- **Test**: a spec in `app/apps/client/e2e/`; `CI=1 TEST_PORT=<port> bunx playwright test <spec> --workers=1 --retries=2` must pass.
- **CI until green**: after each push, watch every check on the PR (Test, pr-build, others) until it finishes: `gh pr checks <n> --watch`. Red → fix the root cause, push, watch again. Report done only when all are green; put the green run link in the task notes (`CI: <url>`).
- **Video**: only the plugin's own before/after video rules and its `demo-video.sh`, from the installed plugin; the project has no recording tool of its own.
- **PR body**: the `detailed-pr` skill's sections; keep the video line and `--attach` from the PR rules.
- **Local app**: `bun app/scripts/review-build.ts <task-id>` (~1 min, waits for a lock) builds the branch's desktop app into `.review-build/<task-id>/` (own port 4100 + n, own data, no updater) and prints its `file://` link. Rebuild after each push.
- **Installers**: CI builds them on every push (`pr-build.yml`, ~10 min) into the shared `pr-builds` prerelease and links them at the end of the PR description (keep its `<!-- pr-build:start/end -->` block when you rewrite the body; edits mail no one, comments and new releases do): `.claude/skills/detailed-pr/scripts/pr-build-links.sh <n> --wait`. None: `gh workflow run pr-build.yml -f pr=<n>`.
- **Notes from a worktree**: the task file lives in the main checkout; add notes with `task_note` (your task id). Lines: `PR: <url>`, `app: <file:// link>`, `build: <macOS> · <Windows> · <Linux>`.
- **Temp files** go in your scratchpad, never the repo or `$TMPDIR`; delete them when done.
