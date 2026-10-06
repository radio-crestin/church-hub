# better-tasks: church-hub specifics
Where this project differs from the better-tasks plugin's own lead and teammate rules. Open when leading or working a better-tasks task. Everything not named here follows the plugin (its texts and `.claude/tasks/config.json` stay untouched); project-wide rules are in the root `CLAUDE.md`.

## Teammates
- **Task file**: it lives in the main checkout, outside your worktree: write your notes with `task_note`.
- **Your environment**: `bun app/scripts/worktree-setup.ts <task-id>` sets up the worktree on port 3100 + n (n = task number). After client changes, rebuild the client for that port (`VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build` in `app/apps/client`).
- **e2e**: always with `CI=1 TEST_PORT=<port>`, or Playwright rebuilds the client for the default port. The plugin's "full tests" are the full suite in the root `CLAUDE.md`. A Playwright video recording needs `viewport` and `recordVideo.size` both `{ width: 1920, height: 1080 }`, or it comes out 800×600.
- **Playwright browser MISSING** while `playwright install` hangs at 100%: unzip the complete zip from `$TMPDIR/playwright-download-*/` into the reported folder and add an empty `INSTALLATION_COMPLETE` file.
- **Cargo** shares the main checkout's target dir: `cargo check` / `clippy` / `test` only.
- **Romanian texts**: have Codex propose each new or changed user-facing string (`codex exec -s read-only "<strings, where they appear, what they do>"`) in short, natural church wording with correct diacritics, no calques; check it in context.
- **The build the user tries** is the review build: `bun app/scripts/review-build.ts <task-id>` builds this branch's desktop app (own port 4100 + n, own data) and prints its `file://` link. Rebuild after each push. The link goes in your notes and the done block as `app: <link>`.
- **Installers only when the user asks**: `gh workflow run pr-build.yml -f pr=<n>` (or `-f platforms=…`); their links come from `.claude/skills/detailed-pr/scripts/pr-build-links.sh <n> --wait`, noted as `build: <links>` and kept in the PR body's `<!-- pr-build:start/end -->` block.

## Lead
- **Finishing question** also gives the `app:` link; installer links only when the user asked for them.
- **Merge**: PRs have no GitHub checks, so a PR is ready once it has no unresolved review comments and no conflicts; anything open goes back to the owner. Main's branch protection needs `--admin` on the plugin's `gh pr merge --squash`; then `git pull --ff-only` in the main checkout.
- **Cleanup** after the merge, from the main checkout, before you stop the teammate: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>` (closes the review app, frees the task's ports, removes the worktree, review build, branches and the PR's installers). A task with no PR still runs it.
- **Plugin**: one user-scope install per machine (`claude plugin install better-tasks@better-tasks`), never a second `--scope project` copy, which goes stale; `.claude/settings.json` turns on its `autoUpdate`.
