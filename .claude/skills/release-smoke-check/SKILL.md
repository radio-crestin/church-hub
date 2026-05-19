---
name: release-smoke-check
description: Smoke-test the bundled Bun sidecar by launching it headlessly and polling /ping until 200 (or failing on early exit). Use before tagging a release to catch the class of bug that killed v0.1.60 silently on macOS. CLAUDE.md mandates this check on every release-affecting change.
disable-model-invocation: true
---

# release-smoke-check

You verify the **bundled** sidecar artifact actually stays alive and answers `/ping`. The v0.1.60 macOS incident proved that `bun dev` succeeding does NOT mean the compiled binary will.

## Steps

1. **Resolve the binary path**. Default candidates by OS:
   - macOS: `app/apps/server/dist/server` (or inside `tauri/target/release/bundle/macos/<App>.app/Contents/MacOS/server-bin`)
   - Linux: `app/apps/server/dist/server`
   - Windows: `app/apps/server/dist/server.exe`

   If the binary doesn't exist, tell the user to run `bun run build:apps` (or `bun run tauri:build`) first. Do **not** rebuild silently.

2. **Run the helper**:
   ```bash
   .claude/skills/release-smoke-check/scripts/smoke.sh [path-to-binary] [port]
   ```
   Defaults: auto-detected binary path; port `3000`.

3. **Interpret the result**:
   - exit 0 → `/ping` returned 200 within timeout → ship-ready signal
   - exit 1 → process exited early; print the captured stdout/stderr (this is exactly the v0.1.60 scenario)
   - exit 2 → process stayed alive but `/ping` never returned 200 within timeout → routing/port-bind regression

4. **On failure**, suggest invoking `cross-platform-reviewer` on the diff that landed since the last green release, since that subagent's whole job is catching this class of bug.

## Notes

- The script does NOT build for you — building is the user's call. This skill is a verifier, not a builder.
- Default timeout is 20s, which matches the v0.1.60 4-second-silent-exit symptom with headroom.
- Logs are written to `/tmp/release-smoke-<pid>.log` so a post-mortem is possible after the script exits.
