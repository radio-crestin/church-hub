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
2. **Port** = 3100 + task number (T-052 → 3152). Port 3000 is the user's dev server: never start, test against or kill it.
   - Setup: `bun install` in `app/`. Build the client with both port vars: `cd app/apps/client && VITE_API_PORT=<port> VITE_SERVER_PORT=<port> bun run build`.
   - Run e2e always with `CI=1 TEST_PORT=<port>`. Without `CI=1`, Playwright starts `dev:web`, whose `free-port.js` kills port 3000.
   - "Executable doesn't exist … headless_shell": `npx playwright install chromium-headless-shell`.
3. **Test.** Write or extend a spec in `app/apps/client/e2e/`. `CI=1 TEST_PORT=<port> bunx playwright test <spec> --workers=1 --retries=2` must pass.
4. **Video**, 10–40 s, showing the fix or feature with the mouse and a note per step.
   - Temp spec `app/apps/client/e2e/_demo-<task-id>.spec.ts` (gitignored), built on `e2e/helpers/demo-recording.ts`: `DEMO_RECORDING`, `installDemoOverlay`, `showCaption`, `glideClick`.
   - Record: `CI=1 TEST_PORT=<port> DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/record-features.sh app/apps/client/e2e/_demo-<task-id>.spec.ts` → `.mp4` + `.gif`.
5. **PR.** `git push -u origin <branch>`. Upload: `DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/upload-demos.sh pr-demos-<branch>` → asset URLs. Open the PR with `detailed-pr`, its UI/UX section embedding `[![demo](<gif url>)](<mp4 url>)` (why not `<video>`: `documented-pr`).
6. **Task file.** Fill its `## PR` section: branch, PR `#<n> <url>`, video `<mp4 url>`. Edit it at the main-checkout path from your prompt, not the worktree copy. Not the front matter: better-tasks rewrites it and drops unknown keys.
7. **Report** to the lead: branch, PR link, video link, commits.
