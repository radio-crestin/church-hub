---
id: T-096
title: "Songs: clicking a song says it doesn't exist"
kind: task
level: normal
order: -3
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T20:41:04.122Z
---

## Goal
User (2026-10-05): «in one open churchhub, when i pressed on a song i got that the song doesn't exist».

Unknown yet: which app (installed release, dev at port 3000, a review build), which list the song was clicked in (songs list, search results, schedule/program, bookmarks/marcaje, history), and which song. Investigate first without asking: look for paths where a song id shown in a list can point to a song that's gone or was never created (deleted/re-imported songs, ids changed by an import or sync, stale search index or cache, schedule/bookmark items pointing at old ids, client cache after a DB reset, the new first-start seeding work in T-094). Read the user's dev server logs read-only (never restart or kill port 3000). If it can't be narrowed down, report to the lead with the 1–2 exact questions for the user.

Done means: root cause found and fixed permanently (no dangling song references; if one still happens, a clear message with a way forward instead of a dead end), e2e spec that reproduces it, before/after video.

## Notes

- 2026-10-05: Video: [T-096.mp4](../tasks_videos/T-096.mp4)
- 2026-10-05: PR: https://github.com/radio-crestin/church-hub/pull/131 (branch fix/song-not-found)
Root cause: no log (installed app, dev server, review builds) ever answered 404 for a song, and the user's DB has no dangling song refs (programs, bookmarks, queue, search index clean). The message came from the client: the song page said "not found" whenever loading stopped without a song, or on ANY error. (1) TanStack Query's default networkMode 'online' pauses every request after the webview's `offline` event (Wi-Fi drop), though the API is local: paused query = "no song" = instant "song not found". (2) A timeout/network/server error did the same. (3) Server getSongById/getSongWithSlides swallowed DB errors as null → 404.
Changed: QueryClientProvider networkMode 'always' (app-wide; no owner listed for the provider, flag if someone minds); fetcher.ts adds fetchJsonWithStatus; songs service getSongById returns null only on 404, throws otherwise; song page: deleted → clearer toast + list refreshed + back to list, failed → new SongLoadError panel (Try again / Back to songs), invalid id → missing; server getters no longer swallow errors (500 + log); en/ro texts (ro via Codex).
Commits: 581a3502 fix(query), a41e1688 fix(songs) client, d2e57894 fix(songs) server, 19f435a1 test(e2e).
Test: CI=1 TEST_PORT=3196 bunx playwright test song-open-not-found.spec.ts --workers=1 --retries=2 (fails 2/3 on main, passes here). Neighbour specs songs/preview-mode/history/schedule-songs-panel/song-key: 40 passed. Unit songs.test.ts + server song tests (99) pass.
Not verified: which window the user actually saw it in (no log names it); the fix covers every client path that could show it. If it shows again, the page now keeps a Try again instead of a dead end.
- 2026-10-05: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-ae274b9d7523d2864/.review-build/T-096/church-hub-T-096.app (port 4196, own data; built from a41e1688..d2e57894, the last push 39ba748d only changed a test)
build: https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-macos-arm64-pr-131-39ba748.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-windows-x64-pr-131-39ba748.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-linux-x64-pr-131-39ba748.AppImage
CI: https://github.com/radio-crestin/church-hub/actions/runs/37360306552 (Test, all green; every PR check green)
Extra commit 39ba748d: my spec left songs with timestamp titles that song-picker-filters' fuzzy search matched (first Test run red); the spec now deletes its songs and uses letter tags. Commits: 581a3502, a41e1688, d2e57894, 19f435a1, 39ba748d.
For the lead: networkMode 'always' in provider/QueryClientProvider.tsx is app-wide (no owner listed). How to test by hand: open a song with Wi-Fi off; it opens. Delete a song in one window, open it from another's list: "Cântarea nu mai există. Poate a fost ștearsă." and back to the list.
- 2026-10-05: User review (2026-10-05), not accepted: «but all the songs are in the sqlite database.. normally if it was displayed it should have worked». The user doesn't buy "Wi-Fi dropped" as the cause: a song that is shown in a list and exists in SQLite must open. Find the real, reproducible path where a song shown in a list can't be opened, starting from the user's words «in one open churchhub» (several Church Hub apps were open at once):
- several apps at once (installed app on 3000, review builds on 41xx with their own data): can a window/client of one app list songs from one server and open them through another (wrong port or base URL, a shared localStorage/IndexedDB/query cache between apps on the same origin, a cached song list from another DB)?
- a list fed by a source other than the songs table (search index/FTS rowid vs song id, semantic search, imported or catalogue entries, history, bookmarks), or ids that differ between list and detail.
Reproduce it with a failing e2e test first, then fix the cause. Keep the fixes already made (they're still right: no dead end, real errors not shown as "not found") unless the real cause makes one unnecessary.
- 2026-10-05: REAL CAUSE (after the user's review): several Church Hub apps on one port. The installed app and the dev server both use port 3000. On start, each kills whatever holds it (shell auto_cleanup_port + server killProcessOnPort). The killed app's window stays open (the shell only logs "exited unexpectedly"), keeps the song list from its own DB, but its requests now reach the other app's server and DB. The user's dev DB and installed DB give the same ids to different songs (5225 = "Cu bucurie să cântaţi" vs "Cuvinte eu nu am de-ajuns"; dev ids go up to 26925, installed stops at 25801). So a listed song "doesn't exist" there, or silently opens as another song. This also explains why no 404 and no song page visit appear in the installed app's log.
Reproduced: e2e/song-open-other-church-hub.spec.ts copies the test DB (the other app), adds a song only here, lists it, starts a 2nd server on the copy, sends the window's /api requests to it, clicks the song. On the previous code: "Cântarea nu mai există" toast (fails); now passes.
Fix: server adds X-Church-Hub-Database (hash of the DB file path; same after a restart, different per app; exposed for CORS; documented in OpenAPI) to every response. Client features/server-identity: fetcher remembers the DB that answers the window. When another one answers, it never uses that answer, clears the remembered pages (old ids) and reloads on the section list (/songs/123 → /songs; /screen/n stays), then ServerChangedNotice explains it (en/ro). The first-round fixes stay (secondary).
Commits: 5c1b6dc0 feat(server), cbae8c24 fix(client), a954c9f3 test(e2e) (plus 581a3502 a41e1688 d2e57894 19f435a1 39ba748d).
Checks: new spec + not-found spec + 5 song specs: 42 passed locally; client unit 1425 pass, server 570 pass. CI Test run https://github.com/radio-crestin/church-hub/actions/runs/37366638832 is QUEUED: every run in the repo (main too) has been queued 10+ min, GitHub isn't starting jobs; the previous run was cancelled at its first step after waiting 15 min. Not green yet.
Video replaced (multi-app before/after). App rebuilt: same app: link (port 4196). Installers in the PR still from 39ba748 (pr-build did not run on the new push).
For startup (T-094 owner) / lead, not changed here: the takeover itself. Options: the shell exits or restarts its sidecar when it dies; don't kill a healthy Church Hub of another data dir on start; or use different default ports for dev vs installed.
- 2026-10-05: User decision (2026-10-05) on the takeover: «Different ports»: the dev app moves to another default port; the installed app keeps 3000. Do it in this task (startup's owner is done; you own it now):
- Pick a dev default port that doesn't clash with anything (installed 3000, worktree 3002/8088, teammates 3100+n / 4100+n), e.g. 3001, and use it for the dev server + Vite proxy/env defaults, Playwright/e2e defaults, scripts (worktree-setup, review-build, free-port), tauri dev config.
- Update every doc/rule that says the dev server is at :3000 (CLAUDE.md "Application specific rules" and Testing, .claude/rules/better-tasks.md "Port 3000 is the user's dev server", README/dev docs), saying it once and linking elsewhere.
- Packaged/installed builds keep 3000 (phones/remotes rely on it). Cross-platform as usual.
- Keep the server-identity fix as the safety net.
- Don't restart or kill the user's running dev server; the new port applies on its next start. Tell the lead what the user must do (e.g. restart `bun dev`) and the new URL.
- 2026-10-05: User 2026-10-05 (during the GitHub Actions outage): «do the tests here and skip github actions». Don't wait for CI: run the checks locally instead (lint, typecheck, client + server unit tests, the full e2e suite serially with CI=1 TEST_PORT=<port> --workers=1 --retries=2, cargo check/clippy if Rust changed, and a review-build of the app) and put the results in the notes. That local run is the acceptance signal for merging.
- 2026-10-05: Different ports DONE, pushed to PR #131 (commits 1875aa3f feat(dev), 812d5118 fix(client), c6ae5bd4 chore(e2e), 355a9bb2 docs; plus merge of main 4665e05b, one import conflict in server index.ts resolved). Dev server = 3001, installed/packaged app keeps 3000, review builds 4100+n, worktree dev 3002 unchanged.
What changed: server getServerPort() (PORT, else 3000 packaged / 3001 dev) for bind, auth redirects, backup sign-in origin; dev:web frees and uses 3001 (it used to free 3000 = killed the installed app); tauri dev + iOS devUrl localhost:3001; lib.rs dev fallback 3001; client getServerPort() in config.ts replaces 6 separate 3000 fallbacks (fetcher, display/page windows, phone sign-in link, OBS export, API docs link); Playwright refuses TEST_PORT 3000/3001; worktree-cleanup never frees either; env samples, OpenAPI servers, README.
LOCAL CHECKS (user: test here, skip GitHub Actions), on 355a9bb2:
- full e2e serial CI=1 TEST_PORT=3196 --workers=1 --retries=2: 724 passed, 34 skipped, 0 failed (12.2 min)
- unit: client 1429 passed; server 564 pass / 16 skip / 0 fail
- typecheck: server clean; client 387 errors, all existing (same error patterns on main), none new
- lint (biome ./apps): no findings in changed files; existing ones in 9 other files
- cargo check OK; cargo clippy 4 existing warnings, none in changed code
- server without PORT binds 3001, not 3000; Playwright refuses TEST_PORT=3001
- review build OK: app on 4196, /ping 200, own X-Church-Hub-Database, never touched 3000/3001
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-ae274b9d7523d2864/.review-build/T-096/church-hub-T-096.app (rebuilt on 355a9bb2)
NOT edited (a teammate's message can't authorize changes to CLAUDE.md, rules or settings; the user applies them):
- CLAUDE.md: "Playwright (http://localhost:3000)" → 3001; "you can test the app accessing http://localhost:3000/" → "http://localhost:3001/ (dev server; the installed app is on 3000)"; "API docs ... http://localhost:3000/api/docs" → 3001; Testing: "dev server at http://localhost:3000" → 3001.
- .claude/rules/better-tasks.md: "Port 3000 is the user's dev server: never start, test against or kill it." → "Ports 3000 (installed app) and 3001 (dev server) are the user's: never start, test against or kill them."
- .claude/settings.json allowlist has curl entries for localhost:3000; the user may add 3001.
USER MUST: after merge, stop the running dev server and start it again (npm run dev:web or npm run dev): dev app then at http://localhost:3001, API docs http://localhost:3001/api/docs. Installed app stays http://localhost:3000.
Outside the repo (dev only): Google sign-in from dev needs http://localhost:3001 in the OAuth worker's ALLOWED_ORIGINS; YouTube sign-in redirect is registered for localhost:3000, so test it in the installed app.
Installers in the PR are still from 39ba748 (pr-build did not run; GitHub Actions down).
- 2026-10-05: Resolved by the user. Root cause: the installed app and the dev app both used port 3000 and killed each other's server; the surviving window read the other DB, where song ids differ. The dev app now uses 3001 (installed keeps 3000), windows detect a different DB (X-Church-Hub-Database) and reload, and real load errors show Try again. Local full e2e 724 passed. PR #131 merged. Instruction-file lines (dev at 3001) go into T-097's instructions patch (user approved).
