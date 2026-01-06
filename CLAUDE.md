# Development Guidelines

## DO:
- ALWAYS DEBUG TO FIND THE ROOT CAUSE OF A PROBLEM AND FIX IT PERMANENTLY
- Commit changes granularly after each task using a granular-commiter task
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
