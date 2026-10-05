<!-- extend -->
<!-- What you write below is added to better-tasks' own teammate text. Delete the first line to replace that text instead. Comments like this one never reach the model. The shipped text, for reference:

# You are a better-tasks teammate
- You own one area. Stay in its files; ask the lead before you touch another owner's.
- Your task file (its path is in this prompt) is your memory: keep short dated notes in its Notes section.
- Given a predecessor's transcript? Search it for what you need instead of redoing its work.
- Keep your context lean and specialised: read only what the task needs; use a subagent for wide searches.
- Commit small and often.
- Done: report to the lead in a few lines (what changed, the commits, what you could not verify), then wait.
- A message starting with HANDOFF: write where you are, what is left and the traps into the task file, then reply.
-->

## Feature or fix: the flow
Every code change follows these steps. Config or tooling tasks only when the lead says so.
1. **Branch.** You start in your own git worktree (`config.json` → `worktree: true`). First run `git switch -c feat/<slug>` (or `fix/<slug>`). Never commit on main.
2. **Setup**: `bun app/scripts/worktree-setup.ts <task-id>` (~5 s). It reuses the main checkout's caches (bun, Cargo target, sidecar, Playwright browser) and builds the client for your port = 3100 + task number. Rebuild after client changes: `cd app/apps/client && VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build`.
   - Port 3000 is the user's dev server: never start, test against or kill it. Run e2e always with `CI=1 TEST_PORT=<port>`; without `CI=1`, Playwright first rebuilds the client without your port, so the page calls port 3000.
   - Cargo shares the main checkout's target dir: `cargo check`/`clippy`/`test` only, no `tauri build`/`dev` by hand. The one exception is `review-build.ts` (step 5), which takes turns through a lock.
   - Browser reported MISSING and `playwright install` hangs at 100%: its zip in `$TMPDIR/playwright-download-*/` is complete. Unzip it into the reported location and create an empty `INSTALLATION_COMPLETE` file there.
   - **Romanian texts via Codex.** For every new or changed user-facing string, ask Codex for the Romanian: `codex exec -s read-only "<strings + where they appear + what they do>"`. Ask for natural, short wording a native Romanian speaker in a church would use (correct diacritics ă â î ș ț, no literal English calques). Then check the result in context and put it in `ro/`.
3. **Test.** Write or extend a spec in `app/apps/client/e2e/`. `CI=1 TEST_PORT=<port> bunx playwright test <spec> --workers=1 --retries=2` must pass.
4. **Video: before and after**, 10–40 s each, same steps, with the mouse and a note per step; a voice reads each note (automatic, macOS `say`: write notes in full words).
   - **Before** (record it first, before you change code): the bug happening, or how it worked before the feature. `installDemoOverlay(page, 'before')`.
   - **After**: the same steps on your branch, showing the fix or the new behavior. `installDemoOverlay(page, 'after')`.
   - A BEFORE / AFTER badge stays in the top-left corner, so captions and voice never say "Before:" / "After:".
   - **Highlight** what matters in both: the bug in Before, the fix or new feature in After. `await highlight(page, locator, 'Bug: …')` draws a red box + arrow + label; `await clearHighlights(page)` before the next step.
   - Can't reproduce the bug for the before video? Say so in your report; don't fake it.
   - Temp spec `app/apps/client/e2e/_demo-<task-id>.spec.ts` (gitignored), built on `e2e/helpers/demo-recording.ts`: `DEMO_RECORDING`, `installDemoOverlay`, `showCaption`, `glideClick`, `highlight`, `clearHighlights`.
   - Record: `CI=1 TEST_PORT=<port> DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/record-features.sh app/apps/client/e2e/_demo-<task-id>.spec.ts` → `.mp4` + `.gif`.
5. **PR.** `git push -u origin <branch>`. Upload: `DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/upload-demos.sh pr-demos-<branch>` → a GIF URL (release asset) and an mp4 URL (`cdn.jsdelivr.net/…`, plays in the browser with voice) per video. Open the PR with `detailed-pr`, its UI/UX section embedding both, one below the other at full width (never a table or side by side): a bold **Before** line, then `[![before](<gif url>)](<jsDelivr mp4 url>)` on its own line; the same for **After**. Never link the release-asset mp4: it downloads instead of playing (why: `documented-pr`).
   - **Local app.** `bun app/scripts/review-build.ts <task-id>` (~1 min, waits if another build runs) builds this branch's desktop app into `.review-build/<task-id>/` and prints its `file://` link. The app has its own port (4100 + task number), data folder, identifier and no updater, so it runs beside the real Church Hub and never touches port 3000 or the church data. Rebuild after each push.
   - **Build.** CI builds installers on every push (`pr-build.yml`, ~10 min) into the shared `pr-builds` prerelease and links them at the end of the PR description (keep its `<!-- pr-build:start/end -->` block when you rewrite the body; edits mail no one, comments and new releases do). Get them: `.claude/skills/documented-pr/scripts/pr-build-links.sh <n> --wait`. None (failed or missing): `gh workflow run pr-build.yml -f pr=<n>`.
6. **PR lines in a task note.** The worktree guard blocks edits to the task file in the main checkout, so add a note with the better-tasks note tool (`task_note`, your task id) instead. Use these lines: `branch: <branch>`, `pr: #<n> <url>`, `before: <mp4 url>`, `after: <mp4 url>`, `build: <macOS url> · <Windows url> · <Linux url>`, `app: <file:// link from review-build.ts>`. The lead copies them into the task file's `## PR` section.
7. **Report** to the lead: branch, PR link, before and after video links, build links, local app link, commits.
8. **Cleanup** after accept, once the PR is merged, from the main checkout: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>` (~1 s locally, a few seconds for GitHub). It removes everything the task made and no longer needs:
   - **Processes:** closes the task's review app and stops its two ports (e2e 3100 + n, review 4100 + n), never 3000.
   - **Disk:** the worktree (test DB, dist, node_modules deleted in the background) and the review build (its folder, bundles left in the Cargo target, the folders macOS/Windows/Linux made for the app).
   - **Git:** the local branch and the empty `worktree-agent-*` branch the worktree started on, only if merged, pushed or the head of a merged PR; then the remote branch and the PR's installers in `pr-builds`, once the PR is merged.
   - **Stays:** shared caches (bun, Playwright, Cargo target) and the PR's demo videos (`pr-demos-*`).
   - **Temp files are yours.** Make them in the scratchpad (never in the repo or `$TMPDIR`: test DBs, clones, extra Cargo targets) and delete each when you no longer need it. Demo recordings can go right after step 5 uploaded them: the PR holds them.
