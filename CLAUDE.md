# Development Guidelines

## DO:
- ALWAYS DEBUG TO FIND THE ROOT CAUSE OF A PROBLEM AND FIX IT PERMANENTLY
- Always create a feature branch BEFORE starting work — never commit directly to `main`. Name the branch after the PR scope (`feat/...`, `fix/...`, `chore/...`) and draft the PR description up front (use the `/documented-pr` skill at the end to flesh it out and attach per-feature demo videos)
- Commit changes granularly after each task using the /commit skill
- Analyze source code in spawned subtasks, return summaries with key insights and file paths (e.g., path/to/file.js:10:20)
- Navigate to claude's cwd first, then cd into the correct folder before running commands
- Centralize database interactions in service folder with only upsert and delete operations
- Make all components mobile responsive
- Keep files small with one function per file, named after the function
- Reuse and organize components properly
- Run lint in a spawned task and fix all issues before committing
- Implement debug logs controlled by env variables with proper logging levels (debug, verbose, trace, info, warning, error)
- Write concise, readable code following KISS, YAGNI, and SOLID principles
- Raise exceptions early in the code flow
- Spawn subtasks with ultrathink for debugging or work requiring deep context
- Keep main task context minimal with only critical insights
- Always add user-facing strings to i18n translation files (apps/client/src/i18n/locales/) instead of hardcoding them. Use the appropriate namespace (common, settings, sidebar, etc.) and ensure translations exist for all supported languages (English and Romanian)
- Always write e2e tests for each new feature

## DON'T:
- Don't overuse try-catch blocks that mask bugs (use minimally, log errors properly)
- Don't perform code exploration or debugging in the main task context (use subtasks instead)
- Don't over-engineer solutions beyond requirements
- when you want to browse the internet to search something or access a page, spawn a task, do the browsing, then extract the most important insights and return them back to the main agent to make the right decision
- Before making any code changes, first map out the complete data flow by tracing all inputs, outputs, and dependencies of the target function/component through the entire codebase, documenting how modifications would ripple through connected systems.
- do not deprecate things, remove things and refactor, we want to keep our code clean
- use feature based architecture where each feature will have it's own directory and all the functionalities grouped inside by service, components, utils, etc. (also you can have sub-features)
- use src directory for source code
- every decision you make, make sure to explore the code or the library documentation page to have an extremly good implementation
- when you're in a middle of a task and the user is asking for a request, make sure to add it on the todo list to make sure that each details gets resolved%

# Application specific rules
- you can test the app accessing http://localhost:3000/ (both client and API are served from this port)
- API docs are available at http://localhost:3000/api/docs
- do not launch the client/server as it's already running
- make sure that any api is integrated into openapi and in scalar docs
- the app must be cross platform (windows, macos and linux)

# Cross-platform compatibility — REQUIRED

Every feature, fix, and build-system change MUST work on macOS, Windows, and Linux. This is non-negotiable for both the Tauri shell (Rust) and the Bun-compiled sidecar.

- Never use `process.execPath` with Node-style flags (`-e`, `--inspect`, etc.) on the compiled sidecar — Bun's standalone ignores them and re-runs the whole binary, which on macOS/Linux/Windows will SIGKILL the parent via the port-cleanup logic. Use a dedicated CLI flag (e.g. `--probe-midi`) handled at the top of `apps/server/src/index.ts`.
- Path resolution must branch on `process.platform === 'darwin' | 'win32' | 'linux'` and account for the differing bundle layouts:
  - macOS: `<App>.app/Contents/MacOS/<bin>` with resources at `<App>.app/Contents/Resources/`
  - Windows / Linux: resources sit next to the executable
- Native modules (MIDI, audio, etc.) must be tested loadable on all three OSes. The `apps/server/scripts/compile.ts` already copies per-OS prebuilds — don't break that.
- Spawned subprocesses: prefer `execFileSync(<bin>, [args], { stdio: 'pipe', timeout: <ms> })` with an array of args. Never shell-interpolate a path on Windows.
- Any new dependency that ships native bindings must have prebuilds for darwin-arm64, darwin-x64, win32-x64, linux-x64.
- Before shipping: run the CI release-build smoke test (`.github/workflows/release-build.yml`) which launches the bundled artifact on all three runners and asserts `/ping` returns 200. Don't merge a release-affecting change if that job is red on any platform.

# Release-build verification

The macOS v0.1.60 build exited silently 4s after launch — root cause: a darwin-only `checkMidiSafety` spawned `process.execPath -e <code>` which Bun's standalone ignored, re-running the sidecar and killing the parent on port 3000. The lesson: smoke-test the *bundled* artifact, not just `bun dev`. CI must:
1. Build the production artifact (`tauri:build` on each OS).
2. Launch the compiled app/sidecar headlessly.
3. Wait up to N seconds for `/ping` to return 200.
4. Fail the run if the process exits early or never becomes ready.
5. Upload stdout/stderr as an artifact for post-mortem.

## Presentation Rendering
- Use the shared `usePresentationContent` hook (`apps/client/src/features/presentation/hooks/usePresentationContent.ts`) for all presentation content rendering
- NEVER create separate rendering engines for LivePreview, ScreenRenderer, or any other presentation display component
- Both LivePreview and ScreenRenderer must use this shared hook to ensure consistent behavior (exit animations, content fetching, visibility calculation)
- When adding new content types or modifying rendering logic, update the shared hook - not individual components

## Worktrees

For worktrees, create a Tauri config override to avoid port conflicts:

```bash
# Copy the sample config
cp tauri/tauri.worktree.conf.json.sample tauri/tauri.worktree.conf.json

# Run with worktree config (extends main config via JSON Merge Patch)
npm run dev:worktree
```

The sample config (`tauri.worktree.conf.json.sample`) contains only the overrides:
- PORT: 3002, VITE_DEV_PORT: 8088
- devUrl: http://localhost:3002
- Window title: "Church Hub (Worktree)"

Edit your local `tauri.worktree.conf.json` to use different ports if needed. This file is gitignored.

## Conventions
- When the user pastes a filename like `/abc/sample.py:XX:YY`, XX is the line number and YY is the number of lines to be selected

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
