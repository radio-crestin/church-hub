# Task worktrees: church-hub specifics
How an agent working a Superfactory task sets up, tests and builds its worktree here. Open when you work a task in a worktree, or finish and clean one up. Project-wide rules are in the root `CLAUDE.md`.

## Working a task
- **Your environment**: `bun app/scripts/worktree-setup.ts <task-id>` sets up the worktree on port 3100 + n (n = task number). After client changes, rebuild the client for that port (`VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build` in `app/apps/client`).
- **Real data** (on Tibi PC): to try a change on the church's real songs, Bible and programs, run `bun app/scripts/use-adunare-copy.ts app/data` before starting your server (`docs/test-machine.md`). The e2e suite keeps its own data.
- **e2e**: always with `CI=1 TEST_PORT=<port>`, or Playwright rebuilds the client for the default port. Full tests are the full suite in the root `CLAUDE.md`. A Playwright video recording needs `viewport` and `recordVideo.size` both `{ width: 1920, height: 1080 }`, or it comes out 800×600.
- **Playwright browser MISSING** while `playwright install` hangs at 100%: unzip the complete zip from `$TMPDIR/playwright-download-*/` into the reported folder and add an empty `INSTALLATION_COMPLETE` file.
- **Cargo** shares the main checkout's target dir: `cargo check` / `clippy` / `test` only.
- **Romanian texts**: write each new or changed user-facing Romanian string yourself, in short, natural church wording with correct diacritics (ș ț with a comma below, never the cedilla ş ţ) and no calques; check it in context in the UI, and list the new RO strings in the PR body for the user to review.
- **The build the user tries** is the review build: `bun app/scripts/review-build.ts <task-id>` builds this branch's desktop app (own port 4100 + n, own data) and prints its `file://` link. Rebuild after each push, and put the link in the task (`app: <link>`).
- **Installers only when the user asks**: `gh workflow run pr-build.yml -f pr=<n>` (or `-f platforms=…`); their links come from `.claude/skills/detailed-pr/scripts/pr-build-links.sh <n> --wait`, noted in the task as `build: <links>` and kept in the PR body's `<!-- pr-build:start/end -->` block.

## Merging and cleanup
- **Merge**: PRs have no GitHub checks, so a PR is ready once it has no unresolved review comments and no conflicts; anything open goes back to the task. Main's branch protection needs `gh pr merge --squash --admin`; then `git pull --ff-only` in the main checkout.
- **Cleanup** after the merge, from the main checkout: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>` (closes the review app, frees the task's ports, removes the worktree, review build, branches and the PR's installers). A task with no PR still runs it.
