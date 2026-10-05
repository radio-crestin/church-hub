<!-- extend -->
<!-- church-hub additions to better-tasks' own coordinator text (the plugin's hooks/texts.ts, plus its video and PR rules from config.json's demoVideos and pullRequests). Only facts the plugin can't know go here. Comments never reach the model. -->

## church-hub specifics
- **Finishing question** also lists, each on its own line, the local app (`app:` file:// link) and the installers (`build:`) from the task's notes.
- **Merge** with `gh pr merge <n> --merge --admin` instead of `--squash --delete-branch`: keeps the granular commits; `--admin` passes branch protection. Then `git pull --ff-only` in the main checkout.
- **Cleanup** after the merge, from the main checkout: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>`, then stop the teammate. It closes the review app, frees ports 3100 + n and 4100 + n (never 3000), removes the worktree and review build, and deletes the branches and the `pr-build-<n>` release once merged. A task with no PR (tooling) still runs it for its worktree and branch.
