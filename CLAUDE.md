- you can test the app accessing http://localhost:3000/ (both client and API are served from this port)
- API docs are available at http://localhost:3000/api/docs
- do not launch the client/server as it's already running
- make sure that any api is integrated into openapi and in scalar docs

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
