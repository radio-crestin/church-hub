---
id: T-098
title: "Faster local review builds: reuse one Tauri shell, swap only the web build (and sidecar) per task"
kind: task
level: normal
order: -5
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T21:51:18.483Z
---

## Goal
User (2026-10-05): «to speed up the builds you might replace only the vite and use the same tauri build if that's possible.. check tauri docs how to speed up concurrent tasks working at the same time on the same pc and update our instructions».

Today review-build.ts (~1 min+, one at a time via a lock) runs a full Tauri build per task.
Done means:
- Read the current Tauri v2 docs (Context7 / tauri.app) on: how the frontend is embedded (frontendDist bundled into the binary vs loaded from a folder or URL), devUrl/dev builds, build caching, sharing a cargo target dir between parallel builds (locks), sccache, and anything Tauri says about speeding up several builds on one machine. Put the findings with links in the notes.
- If possible: build the Tauri shell (Rust) once per shell change and reuse it for every task, so a review build only rebuilds what the task changed: the Vite web build, and the Bun sidecar when server code changed. Rebuild Rust only when tauri/ or its Cargo files changed. Each review app keeps its own port and data folder, and several can run at once.
- Measure before/after review-build times, and with 3 teammates building at the same time.
- Must still be a faithful review of the task's code (same shell version as main); cross-platform (macOS, Windows, Linux).
- Update .claude/rules/better-tasks.md (Local app, Cargo lines) and any doc that describes review builds.
Related: T-097 (same files: review-build.ts, rules), so the same owner does it after T-097.

## Notes

- 2026-10-06: review-builds-2, branch chore/review-build-shared-shell (worktree agent-ae99988d521f90a0a). No video: tooling only, the app looks the same.

Tauri docs (v2.11):
- frontendDist is embedded (compressed) in the binary at compile time by generate_context! (https://tauri.app/reference/config, BuildConfig.frontendDist). A URL instead changes the origin and needs remote IPC capabilities (https://tauri.app/reference/acl/capability), so it's not a faithful review.
- Context::set_assets swaps the asset provider and Context::config_mut changes identifier, windows and plugins before Builder::build (docs.rs/tauri Context). single-instance, window-state and the app folders follow config.identifier.
- `tauri build --no-bundle`, `tauri bundle` and custom cargo profiles via `-- --profile x` (https://tauri.app/reference/cli, https://tauri.app/distribute/app-store). `tauri bundle` can't take a custom profile.
- Speed: https://tauri.app/concept/size (incremental, codegen-units). Tauri has nothing on sharing CARGO_TARGET_DIR, sccache or parallel builds: cargo locks the target dir, so Rust builds stay one at a time.

What changed:
- tauri/src/review.rs + cargo feature `review-shell` (off in releases). The shell reads review-build.json at start (port, data folder, identifier, window title, web build folder). It serves the task's web build from disk on the same tauri:// origin and points the updater at a dead endpoint. A review shell without the file refuses to start. The compile-time CHURCH_HUB_SERVER_PORT/CHURCH_HUB_DATA_DIR hooks are removed. New `[profile.review]` keeps target/release untouched.
- scripts/review-shell.ts compiles the shell once per hash of app/tauri + app/tauri-plugins (committed or not; resources and bin excluded) into main/.review-build/.shells/<key>/ and keeps the newest 3. The lock is held only while compiling.
- scripts/review-build.ts copies the shell, builds the task's client for the review port straight into the app, then adds the task's sidecar, the resources, review-build.json, and the Info.plist identity on macOS. Layouts follow Tauri's installers: macOS .app; Windows a folder with church-hub.exe and resources beside it; Linux usr/bin + usr/lib/church-hub. The worktree's dist/ is no longer touched.
- .claude/rules/better-tasks.md: Local app and Cargo lines.

Measured (macOS, 18 cores):
- Before: 67 s per build (cargo 54 s). 3 at once: 62/162/245 s, the last after 4.1 min (lock).
- After: 6 s per build. 3 at once (3 worktrees): 9/9/9 s.
- Task that changed Rust: 67 s, its own shell, built once.
- The first shell under the new profile: 1m42 (one time).

Tested on macOS:
- T-098 app ready on 4198 with data in its own folder; window "Church Hub T-098 (review build)"; WebKit storage under com.church-hub.review.t098.
- T-901 and T-902 running at once, each on its own port and data.
- cargo check/clippy with and without the feature are clean; biome clean.

Not verified: Windows and Linux, which can't run here. A cross-platform-reviewer read found no blockers and was addressed: dist placeholder; a clear error when Windows locks a running app.

Pre-existing, not mine (server area): on Linux the sidecar's getResourcesDir (apps/server/src/utils/paths.ts:63) looks next to the exe, while installed resources sit in usr/lib/church-hub. MIDI may not load on Linux installs too.

macOS asks "church-hub would like to access files in your Documents folder" on first start, because the data lives under ~/Documents/.../.review-build. It probably was already so (same data path). The shell binary is now identical across tasks, so one Allow should cover them all (unverified).
- 2026-10-06: PR: https://github.com/radio-crestin/church-hub/pull/135 (branch chore/review-build-shared-shell)
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-098/church-hub-T-098.app
e2e: 738/738 green (34 skipped, as on main), full suite run locally and serially (CI=1 TEST_PORT=3198 --workers=1 --retries=2) on 95f6c4b4. The last commit, d58f7a2d, changes only the review scripts.
Commits: 06580f89 (Rust review shell), 3186f42b (scripts), 95f6c4b4 (rules), d58f7a2d (fixes from the cross-platform review).
- 2026-10-06: Resolved by the user. The review Tauri shell is built once per shell version and reused; each task swaps only its web build and sidecar. Review build 67 s → 6 s, 3 at once 245 s → 9 s. Full local e2e 738/738. PR #135 merged. Found on the way (not fixed): on installed Linux, the sidecar looks for resources next to the exe (apps/server/src/utils/paths.ts:63) instead of usr/lib/church-hub, so MIDI may not load.
