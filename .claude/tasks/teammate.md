<!-- extend -->
<!-- church-hub additions to better-tasks' own teammate text (the plugin's hooks/texts.ts, plus its video and PR rules from config.json's demoVideos and pullRequests). Only facts the plugin can't know go here; the plugin's flow (worktree, video with Kokoro, PR with --attach) stays as shipped. Comments never reach the model. -->

## church-hub specifics
- **Branch**: `git switch -c feat/<slug>` (or `fix/<slug>`) first; push it under that name, not `task/T-xxx` (CLAUDE.md rule).
- **Setup**: `bun app/scripts/worktree-setup.ts <task-id>` (~5 s): reuses the main checkout's caches, builds the client for your port = 3100 + task number. After client changes: `cd app/apps/client && VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build`.
- **Port 3000** is the user's dev server: never start, test against or kill it. e2e always with `CI=1 TEST_PORT=<port>` (without `CI=1`, Playwright rebuilds the client for port 3000). Capture video steps against your port too.
- **Cargo** shares the main checkout's target dir: `cargo check`/`clippy`/`test` only; no `tauri build`/`dev` by hand, except `review-build.ts` (below).
- **Playwright browser MISSING** and `playwright install` hangs at 100%: unzip its complete zip from `$TMPDIR/playwright-download-*/` into the reported folder and add an empty `INSTALLATION_COMPLETE` file.
- **Romanian texts via Codex**: for each new or changed user-facing string, `codex exec -s read-only "<strings + where they appear + what they do>"`; ask for short, natural church wording with correct diacritics (ă â î ș ț), no calques. Check it in context, put it in `ro/`.
- **Test**: a spec in `app/apps/client/e2e/`; `CI=1 TEST_PORT=<port> bunx playwright test <spec> --workers=1 --retries=2` must pass.
- **PR body**: the `detailed-pr` skill's sections; keep the video line and `--attach` from the PR rules.
- **Local app**: `bun app/scripts/review-build.ts <task-id>` (~1 min, waits for a lock) builds the branch's desktop app into `.review-build/<task-id>/` (own port 4100 + n, own data, no updater) and prints its `file://` link. Rebuild after each push.
- **Installers**: CI builds them on every push (`pr-build.yml`, ~10 min): `.claude/skills/documented-pr/scripts/pr-build-links.sh <n> --wait`. None: `gh workflow run pr-build.yml -f pr=<n>`.
- **Notes from a worktree**: the task file lives in the main checkout; add notes with `task_note` (your task id). Lines: `PR: <url>`, `app: <file:// link>`, `build: <macOS> · <Windows> · <Linux>`.
- **Temp files** go in your scratchpad, never the repo or `$TMPDIR`; delete them when done.
