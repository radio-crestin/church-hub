---
id: T-094
title: "First start: find why the app seems stuck, show a loading page with progress, make startup fast"
kind: task
level: normal
order: -1
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T19:08:09.873Z
---

## Goal
User (2026-10-05): «work why on first setup the app seems to be stuck.. we want the app to start, eventually have a loading page with what's doing.. also optimize the startup to be as fast as possible, and efficient..».

Done means:
- Root cause: measure a real FIRST start (fresh data folder, like a new install) of the packaged desktop app and find what blocks or takes time (sidecar start, DB creation/migrations, seeding songs/Bible, imports, font/asset loading, port checks, window waiting on /ping…). Write the timings (before/after) in the notes.
- The window appears right away and shows a loading page that says what is happening, step by step, in plain words (en + ro), with progress where it is known — never a frozen or blank window. If a step fails, the page says so with a way forward, not an endless spinner.
- Startup as fast and efficient as possible, on first and normal starts: do only what's needed before the app is usable, defer or run in the background the rest, no repeated work on later starts.
- Works on macOS, Windows and Linux (CLAUDE.md cross-platform rules; the CI release-build smoke test stays green).
- e2e spec for the loading page; before/after 1080p video.
Related: T-090's notes mention the "Starting up" splash showing briefly when a page opens.

## Notes

- 2026-10-05: Video: [T-094.mp4](../tasks_videos/T-094.mp4)
PR: https://github.com/radio-crestin/church-hub/pull/132
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-af14ebeed4be952c6/.review-build/T-094/church-hub-T-094.app (data folder left empty = a real first start)
Root cause (measured on the packaged review build, fresh data folder, macOS M-series): no window for 7.26 s. (1) Tauri setup blocked on /ping and a window only shows after setup returns; (2) the boot server ran on the sidecar's main thread, which seeding (26,463 songs, Bibles) + the song search index (3.9 s) kept busy, so /ping and /health went unanswered; (3) 66 MB of fixture JSON was imported as modules and parsed on every start (~0.6 s).
Timings before → after: first start window 7.26 s → 0.26 s, steps shown from ~0.5 s, usable 7.26 s → ~4.9 s; normal start window 1.45 s → 0.26 s, server ready 1.45 s → 0.61 s.
Changed: window no longer waits for the server; boot server in a worker thread (blob URL, in-thread fallback) with step/progress/firstRun in /health; fixtures embedded as files and read only when seeding; free port skips lsof/netstat; loading page lists steps with a progress bar (en+ro, new startup.json), a stopped server gets a "Restart the server" button at once.
Commits: 55e2d112 67a88d3f c9b0d2b8 d32c0e34 ff1bf8ff.
Test: server bun test 558 pass; e2e startup-loading-page.spec.ts (5) + loading-screen-fade pass (CI=1 TEST_PORT=3194). By hand: open the app link above (empty data folder) and watch the steps.
Not verified: Windows/Linux by hand (CI release smoke test covers /ping); remaining first-start cost is the song search index (~3.5 s), FTS5 automerge-off would save ~0.9 s but made trigram search ~15x slower, so left out. Demo video is 1280x856 (the plugin's max side), not 1080p.
- 2026-10-05: CI: https://github.com/radio-crestin/church-hub/actions/runs/37358434849 (unit, server, e2e, release-build smoke on macOS/Windows/Linux: all green; pr-build and CodeQL green on 919b6273)
build: https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-macos-arm64-pr-132-919b627.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-windows-x64-pr-132-919b627.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-linux-x64-pr-132-919b627.AppImage
Extra commit after a cross-platform review: 919b6273. The boot-server worker stop and fallback no longer abort the start. The compiled-sidecar smoke test now builds with the release flags (minify) and asserts that the worker ran and the first start seeded the songs from the embedded fixture. Added isPortFree tests. Review app rebuilt from 919b6273; its data folder is empty, so opening it is a real first start.
- 2026-10-05: Resolved by the user. The window opens at once (7.26 s → 0.26 s) with a step-by-step loading page; the boot server runs in a worker thread; fixtures are read only when seeding. First start is usable in ~4.9 s (was 7.3 s), normal start server-ready 1.45 s → 0.61 s. PR #132 merged.
