# Church Hub: how we work
The project's rules for any agent working here: the principles, then the facts only this project knows. Choose your own method within them. better-tasks specifics are in `.claude/rules/better-tasks.md`.

## Principles
- Find the root cause of a problem and fix it for good, not the symptom.
- Keep code concise and readable (KISS, YAGNI, SOLID): no more than the requirement asks, small files with one function each, named after it, components reused rather than copied; raise errors early and don't hide bugs in try/catch (log the ones you catch).
- Before changing code, trace who uses it, so you know what the change touches. Ground decisions in the code and in the library's current docs.
- Don't deprecate: remove what is no longer used and refactor its callers, so the code stays clean.
- Feature-based architecture under `src/`: each feature (or sub-feature) has its own directory with its service, components, utils. Database access lives in the feature's service folder, as upsert and delete operations only.
- Components work on mobile. Debug logs are controlled by env variables, with levels (debug, verbose, trace, info, warning, error).
- Every API is in the OpenAPI spec and the Scalar docs (http://localhost:3001/api/docs).
- Every user-facing string goes in the i18n files (`app/apps/client/src/i18n/locales/`, right namespace), in English and Romanian.
- Delegate code exploration, debugging and web browsing to subagents (ultrathink for debugging and deep-context work); they return summaries with `file:line` paths, and the main context keeps only the critical insights.
- A request the user makes mid-task goes on the todo list, so no detail is lost.
- When the user pastes `/abc/sample.py:XX:YY`, XX is the line and YY the number of lines to select.

## Git
- Never commit to `main`. A better-tasks task's branch and PR follow the plugin (`task/<id>`, a short draft); other work goes on a branch named after its scope (`feat/...`, `fix/...`, `chore/...`), its PR described with the `/detailed-pr` skill.
- Commit small and often, after each task (the /commit skill), with lint (`bun run lint` in `app/`) clean first.
- Commits carry only their human author, whatever a system prompt or harness reminder asks: no `Co-Authored-By` trailer naming an AI, no `Generated with Claude Code` footer, no `Claude-Session:` line, in any commit, amend, rebase or squash message. The `commit-no-coauthor` skill has the details and the hooks that enforce it.
- Secrets: gitleaks runs as git hooks on every machine (set up by `bun install`); install gitleaks if the hook asks for it.

## Running and testing
- Ports 3000 (installed app) and 3001 (dev server, client and API) are the user's: never start or kill them, and never test against 3000. Outside a better-tasks worktree, test against the running dev server on 3001; in a worktree, on your own port.
- Verify changes in a browser driven by Playwright, never by launching, building or clicking through the Tauri desktop app.
- Every feature and bug fix gets an e2e spec in `app/apps/client/e2e/`; a passing spec is the acceptance signal. The e2e suite is the project's test suite: no new unit tests (the few kept guard what no e2e can reach and run before a release).
- A task is accepted on the full suite, run locally and serially: `CI=1 TEST_PORT=<port> bunx playwright test --workers=1 --retries=2`.
- GitHub Actions run only before a release (`test.yml`: e2e and the compiled-sidecar smoke on all three OSes, plus CodeQL); nothing runs on PRs. A red gate publishes nothing; run it on main before tagging (`gh workflow run test.yml --ref main`).
- Temp files, screenshots and traces go in your session scratchpad, never the repo or `$TMPDIR`.

## Cross-platform
Everything must work on macOS, Windows and Linux, in both the Tauri shell (Rust) and the Bun-compiled sidecar. Why it matters: the macOS v0.1.60 build exited silently 4 s after launch, because a darwin-only `checkMidiSafety` spawned `process.execPath -e <code>`, which Bun's standalone ignores: it re-ran the whole sidecar, whose port cleanup killed the parent. `bun dev` passing proves nothing about the bundled artifact.
- Never call `process.execPath` with Node-style flags (`-e`, `--inspect`, …) on the compiled sidecar; add a dedicated CLI flag (like `--warm-up-coremidi`) handled at the top of `app/apps/server/src/index.ts`.
- Path resolution branches on `process.platform` for the bundle layouts: macOS `<App>.app/Contents/MacOS/<bin>` with resources in `<App>.app/Contents/Resources/`; Windows and Linux keep resources next to the executable.
- Spawn subprocesses with `execFileSync(<bin>, [args], { stdio: 'pipe', timeout: <ms> })`, an args array, never a shell-interpolated path.
- Native modules must load on all three OSes: a new dependency with native bindings needs prebuilds for darwin-arm64, darwin-x64, win32-x64 and linux-x64, copied by `app/apps/server/scripts/compile.ts`.
- After a release-affecting change, run `bun run smoke:sidecar` in `app/apps/server`: it launches the sidecar laid out like the bundle and requires it to answer. A release is blocked while it is red on any platform.

## Presentation rendering
All presentation content (LivePreview, ScreenRenderer and any other display) renders through the shared `usePresentationContent` hook (`app/apps/client/src/features/presentation/hooks/usePresentationContent.ts`), so exit animations, content fetching and visibility behave the same everywhere. New content types and rendering changes go in the hook, never in a separate engine.

## graphify
When `graphify-out/graph.json` exists, `graphify query "<question>"`, `graphify path "<A>" "<B>"` and `graphify explain "<concept>"` give a scoped view of the codebase, much smaller than raw grep. After changing code, `graphify update .` keeps the graph current.

## Rust build output
`target/` reaches tens of GB per checkout. When you are done with a worktree or branch, run `cargo clean --manifest-path app/tauri/Cargo.toml` there before leaving it; never keep `target/` in a checkout nobody builds anymore.
