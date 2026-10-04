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
   - Cargo shares the main checkout's target dir: `cargo check`/`clippy`/`test` only, no `tauri build`/`dev`.
   - Browser reported MISSING and `playwright install` hangs at 100%: its zip in `$TMPDIR/playwright-download-*/` is complete. Unzip it into the reported location and create an empty `INSTALLATION_COMPLETE` file there.
3. **Test.** Write or extend a spec in `app/apps/client/e2e/`. `CI=1 TEST_PORT=<port> bunx playwright test <spec> --workers=1 --retries=2` must pass.
4. **Video: before and after**, 10–40 s each, same steps, with the mouse and a note per step.
   - **Before** (record it first, before you change code): the bug happening, or how it worked before the feature. Captions start with "Before:".
   - **After**: the same steps on your branch, showing the fix or the new behavior. Captions start with "After:".
   - **Highlight** what matters in both: the bug in Before, the fix or new feature in After. `await highlight(page, locator, 'Bug: …')` draws a red box + arrow + label; `await clearHighlights(page)` before the next step.
   - Can't reproduce the bug for the before video? Say so in your report; don't fake it.
   - Temp spec `app/apps/client/e2e/_demo-<task-id>.spec.ts` (gitignored), built on `e2e/helpers/demo-recording.ts`: `DEMO_RECORDING`, `installDemoOverlay`, `showCaption`, `glideClick`, `highlight`, `clearHighlights`.
   - Record: `CI=1 TEST_PORT=<port> DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/record-features.sh app/apps/client/e2e/_demo-<task-id>.spec.ts` → `.mp4` + `.gif`.
5. **PR.** `git push -u origin <branch>`. Upload: `DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/upload-demos.sh pr-demos-<branch>` → asset URLs. Open the PR with `detailed-pr`, its UI/UX section embedding both, labeled **Before** / **After**: `[![before](<gif url>)](<mp4 url>)` (why not `<video>`: `documented-pr`).
   - **Build.** CI builds installers on every push (`pr-build.yml`, ~25 min) and links them in a PR comment. Get them: `.claude/skills/documented-pr/scripts/pr-build-links.sh <n> --wait`. None (failed or missing): `gh workflow run pr-build.yml -f pr=<n>`.
6. **Task file.** Fill its `## PR` section: branch, PR `#<n> <url>`, videos `before: <mp4 url>`, `after: <mp4 url>`, `build: <macOS url> · <Windows url> · <Linux url>`. Edit it at the main-checkout path from your prompt, not the worktree copy. Not the front matter: better-tasks rewrites it and drops unknown keys.
7. **Report** to the lead: branch, PR link, before and after video links, build links, commits.
8. **Cleanup** after accept, from the main checkout: `bun app/scripts/worktree-cleanup.ts <task-id> <branch>` (~1 s). It stops only your port, unlocks and removes the worktree (test DB, dist, node_modules deleted in the background), and deletes the branch only if merged or pushed. Shared caches stay.
