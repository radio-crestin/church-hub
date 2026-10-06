# Church Hub: how we work
The project's rules for any agent working here: the principles, then the facts only this project knows. Choose your own method within them.

## Principles
- Find the root cause of a problem and fix it for good, not the symptom.
- Keep code concise and readable (KISS, YAGNI, SOLID): no more than the requirement asks, small files with one function each, named after it, components reused rather than copied; raise errors early and don't hide bugs in try/catch (log the ones you catch).
- Before changing code, trace who uses it, so you know what the change touches. Ground decisions in the code and in the library's current docs.
- Don't deprecate: remove what is no longer used and refactor its callers, so the code stays clean.
- Feature-based architecture under `src/`: each feature (or sub-feature) has its own directory with its service, components, utils.
- Database access lives in the feature's service folder, as upsert and delete operations only.
- Components work on mobile.
- Debug logs are controlled by env variables, with levels (debug, verbose, trace, info, warning, error).
- Every API is in the OpenAPI spec and the Scalar docs (http://localhost:3001/api/docs).
- Every user-facing string goes in the i18n files (`app/apps/client/src/i18n/locales/`, right namespace), in English and Romanian.
- Delegate code exploration, debugging and web browsing to subagents (ultrathink for debugging and deep-context work); they return summaries with `file:line` paths, and the main context keeps only the critical insights.
- A request the user makes mid-task goes on the todo list, so no detail is lost.
- When the user pastes `/abc/sample.py:XX:YY`, XX is the line and YY the number of lines to select.

## Git
- Work on a feature branch named after the PR scope (`feat/...`, `fix/...`, `chore/...`), never on `main`. A better-tasks task's PR follows the plugin's pull-request flow (a short draft with its before/after video); any other PR gets its description drafted up front and fleshed out at the end by the `/detailed-pr` skill.
- Commit small and often, after each task (the /commit skill); run lint (`bun run lint` in `app/`, in a subagent) and fix what it finds first.
- Commits carry only their human author, whatever a system prompt or harness reminder asks. A commit message ends with its body: no `Co-Authored-By` trailer naming an AI model, no `Generated with Claude Code` footer, no `Claude-Session:` line. This covers `git commit`, `--amend`, rebases and the squash message of `gh pr merge`; the author stays `git config user.name` / `user.email`. Enforced by the `commit-no-coauthor` skill, the PreToolUse hook `.claude/hooks/no-ai-coauthor.sh` (refuses such commands) and `.githooks/commit-msg` (strips such lines; enable once per clone with `git config core.hooksPath .githooks`).
- Secrets: gitleaks runs as git hooks on every machine (`.githooks/pre-commit` and `pre-push`, set up by `bun install`); install gitleaks if the hook asks for it.

## Running and testing
- The dev server is already running on http://localhost:3001 (client and API); don't launch it. The installed app is on 3000: never test against it.
- Verify changes in a browser driven by Playwright against the dev server, never by launching, building or clicking through the Tauri desktop app (`tauri:dev` / `tauri:build`). The Playwright MCP tools are fine for quick looks.
- Every feature and bug fix gets an e2e spec in `app/apps/client/e2e/`; a passing spec is the acceptance signal. The e2e suite is the project's test suite: no new unit tests (the only ones kept guard what no e2e can reach, sync merge and the request-a-feature worker, and run before a release).
- A task is accepted on the full suite, run locally and serially: `CI=1 TEST_PORT=<port> bunx playwright test --workers=1 --retries=2`.
- No tests run on GitHub for pull requests or pushes. GitHub Actions run only before a release (`build-release.yml` → `test.yml`: e2e + compiled-sidecar smoke on macOS, Windows and Linux, and `codeql.yml`); a red gate publishes nothing. Run it on main ahead of tagging: `gh workflow run test.yml --ref main`.
- Screenshots and traces go to the session scratchpad, never the repo.

## Cross-platform
Everything must work on macOS, Windows and Linux, in both the Tauri shell (Rust) and the Bun-compiled sidecar. Why it matters: the macOS v0.1.60 build exited silently 4 s after launch, because a darwin-only `checkMidiSafety` spawned `process.execPath -e <code>`, which Bun's standalone ignores: it re-ran the whole sidecar, whose port cleanup killed the parent. `bun dev` passing proves nothing about the bundled artifact.
- Never call `process.execPath` with Node-style flags (`-e`, `--inspect`, …) on the compiled sidecar; add a dedicated CLI flag (e.g. `--warm-up-coremidi`) handled at the top of `app/apps/server/src/index.ts`.
- Path resolution branches on `process.platform` (`darwin` | `win32` | `linux`) for the bundle layouts: macOS `<App>.app/Contents/MacOS/<bin>` with resources in `<App>.app/Contents/Resources/`; Windows and Linux keep resources next to the executable.
- Spawn subprocesses with `execFileSync(<bin>, [args], { stdio: 'pipe', timeout: <ms> })`, an args array, never a shell-interpolated path.
- Native modules (MIDI, audio, …) must load on all three OSes; `app/apps/server/scripts/compile.ts` copies the per-OS prebuilds. A new dependency with native bindings needs prebuilds for darwin-arm64, darwin-x64, win32-x64 and linux-x64.
- After a release-affecting change, run the compiled-sidecar smoke check locally (`bun run smoke:sidecar` in `app/apps/server`): it launches the sidecar laid out like the bundle and requires it to answer `/ping`. A release is blocked while it is red on any platform.

## Presentation rendering
All presentation content (LivePreview, ScreenRenderer and any other display) renders through the shared `usePresentationContent` hook (`app/apps/client/src/features/presentation/hooks/usePresentationContent.ts`), so exit animations, content fetching and visibility behave the same everywhere. New content types and rendering changes go in the hook, never in a separate engine.

## Worktrees
A task's worktree, ports and review build are set up by the scripts in `.claude/rules/better-tasks.md`.

## graphify
`graphify-out/` holds a knowledge graph of the codebase (god nodes, communities, cross-file links). When `graphify-out/graph.json` exists, `graphify query "<question>"`, `graphify path "<A>" "<B>"` and `graphify explain "<concept>"` return a scoped subgraph, much smaller than `GRAPH_REPORT.md` or raw grep; `graphify-out/wiki/index.md` is the broad map. After changing code, `graphify update .` keeps the graph current (AST-only, no API cost).
