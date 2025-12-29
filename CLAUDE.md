- you can test the app accessing http://localhost:3000/ (both client and API are served from this port)
- API docs are available at http://localhost:3000/api/docs
- do not launch the client/server as it's already running
- make sure that any api is integrated into openapi and in scalar docs

## Worktrees

For worktrees, set unique ports to avoid conflicts:

```bash
PORT=3001 VITE_DEV_PORT=8087 npm run dev
```

Note: For Tauri, also update `tauri/tauri.conf.json` → `build.devUrl` to match PORT.
