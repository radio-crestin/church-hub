---
id: T-058
title: Fix all Dependabot vulnerabilities and CodeQL alerts
sprint: 2026-09-28
urgent: false
status: done
owner: security-deps
rolled: 0
order: -14
created: 2026-10-04
---
## Goal
User 2026-10-04: "add also a task to fix all dependabot vulnerabilities and also codeql reported problems https://github.com/radio-crestin/church-hub/security/code-scanning".
State on 2026-10-04: Dependabot 54 open (9 high, 35 medium, 10 low); CodeQL 33 open (28 high, 5 medium). List: `gh api 'repos/radio-crestin/church-hub/dependabot/alerts?state=open&per_page=100' --paginate`, `gh api 'repos/radio-crestin/church-hub/code-scanning/alerts?state=open&per_page=100' --paginate`.
Done when: every open alert is fixed (upgrade/override for deps; a real code fix for CodeQL), or dismissed on GitHub with a written reason only when it is a true false positive or not reachable (list those for the user). App still builds and runs on macOS/Windows/Linux (native deps: MIDI, audio — prebuilds for all 4 targets), e2e and unit tests pass, PR build green.
Split: two teammates — security-deps (package.json/bun.lock/Cargo.toml/Cargo.lock, one PR) and security-code (CodeQL fixes in source, one PR); they don't edit each other's files.

## Notes
- 2026-10-04: Owners: security-deps (dependencies) and security-code (CodeQL source fixes).
- 2026-10-04: security-code 2026-10-04: the 33 GitHub CodeQL alerts are stale (last scan 2026-01-14, CodeQL default setup now "not-configured"). A local CodeQL run on main finds 60 results (adds xss-through-dom x6, client-side-unvalidated-url-redirection x2, insecure-randomness x2, redos x1, stack-trace-exposure x12). security-code fixes all 60 in one PR (fix/codeql-alerts), including the one in e2e/settings.spec.ts. CodeQL must scan again so alerts close after merge: ci-builds adds a .github/workflows/codeql.yml (advanced setup, JS/TS + Rust if supported, on push to main, PRs and weekly), using latest stable actions — no repo-settings change.
- 2026-10-04: security-deps (2026-10-04): PR #86 https://github.com/radio-crestin/church-hub/pull/86, branch fix/dependabot-vulnerabilities. Commits 6537a2a9 (hono 4.13.12 + wrangler 4.147 → undici 7.29.1, sharp 0.35.4, ws 8.21.0, esbuild 0.28.1, workers-types v5), 21b9fab7 (vitest 4.1.11 + ScreenBackground.test restoreAllMocks), 0e6988b8 (app/tauri: tauri 2.11.6 with siblings pinned to 2.11 line, quinn-proto 0.11.15, serde_with 3.21.0, rand 0.8.6/0.9.3; @tauri-apps/api ^2.11.1), fae2144b (plugin lock: tauri 2.11.6, bytes 1.11.1, time 0.3.47, serde_with 3.21.0, rand 0.8.6), 5b6066de merge main. Alert → fix table in PR §3. Dismiss candidates: #6 #7 glib 0.18 (gtk3 stack of Tauri 2, fix needs glib 0.20/GTK4, VariantStrIter unused); #152 #153 rand 0.7.3 (build-time only via phf_codegen→selectors→kuchikiki→tauri-utils; 0.8 part fixed). Tests: backend npm audit 0, tsc, wrangler dry-run; client vitest 1373 pass (4 usePersistedChoice fail same on main: localStorage undefined under Node 26); server bun test 407 pass; cargo check/test/clippy; e2e health/songs/bible/presentation/presentation-flow/screen-rendering/music 42 pass serial; review build OK. Stray: app/tauri-plugins/tauri-plugin-screen-brightness/target/ has 3126 tracked build files; app/ffmpeg-x86_64-git-685011003.7z tracked in repo. Not verified: PR build on 3 OSes (pending), Worker prod deploy.
branch: fix/dependabot-vulnerabilities
pr: #86 https://github.com/radio-crestin/church-hub/pull/86
before: (none, no user-visible change)
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@afaadc5f42cadbb9b78d69d6418d6587b00d9727/pr-demos-fix-dependabot-vulnerabilities/app-still-works-after-the-dependency-updates.mp4
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-add6b7e61ffd50215/.review-build/T-058/church-hub-T-058.app
- 2026-10-04: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-86/church-hub-macos-arm64-pr-86-5b6066d.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-86/church-hub-windows-x64-pr-86-5b6066d.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-86/church-hub-linux-x64-pr-86-5b6066d.AppImage (PR #86 build green on macOS, Windows, Linux at 5b6066d)
- 2026-10-04: security-code (CodeQL) — 2026-10-04
branch: fix/codeql-alerts
pr: #89 https://github.com/radio-crestin/church-hub/pull/89
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@a261e0af4c4c50272e30e5a5a671276aae1ffe6f/pr-demos-fix-codeql-alerts/T-058-after.mp4 (no before: no user-visible change)
What: GitHub's 33 alerts were from a Jan scan; local CodeQL on current main found 60 → 1 after this branch. Alert → fix: #11-28 multi-char sanitization → removeHtmlTags/removeXmlTags loop to fixpoint; #4-9 double-escaping → single-pass decodeHtmlEntities; #29-33 stack-trace → /health drops stack, toErrorMessage in responses; #10 auth.ts → toScriptLiteral + escapeHtml (was real reflected XSS on the OAuth worker); #1-2 → isYouTubeUrl by host; new finds: xss-through-dom/url-redirection → toSafeHttpUrl, insecure-randomness → crypto.randomInt, redos → linear parseAppVersion, e2e regex escape.
False positive to dismiss: #3 js/insufficient-password-hash (obs/websocket-client.ts) — OBS WebSocket v5 protocol mandates base64(sha256(password+salt)).
Test: client vitest (all pass except pre-existing usePersistedChoice, fixed on main by #87), server bun 415 pass, worker bun 5 pass, e2e text-sanitization + 10 regression specs 83 pass. Alerts close on GitHub only after codeql.yml (now on main) scans main post-merge.
Not verified: deployed Cloudflare worker pages; mobile pairing on a device.
- 2026-10-04: security-code PR #89 builds: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-89/church-hub-macos-arm64-pr-89-2b5eede.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-89/church-hub-windows-x64-pr-89-2b5eede.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-89/church-hub-linux-x64-pr-89-2b5eede.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-058-code/church-hub-59.app (port 4159)
CI on PR: CodeQL (actions, js/ts, rust) pass, builds pass on all 3 OSes. Commits: ac177e32 21dce77f e24de8bc 1d7b53ec 6cd08a9d e1d370b3 0a70c021 9ed63cbb (+ merge of main 2b5eede9).
- 2026-10-04: User 2026-10-04: Mark as resolved. PR #89 merged (5179069f). PR #86 conflicts with main after #88/#89 — security-deps rebasing, then lead merges. Dismissed on GitHub with reasons (user approved): Dependabot #6 #7 glib (tolerable_risk), #152 #153 rand 0.7 (not_used), CodeQL #3 OBS password hash (false positive). Stray files → T-062.
- 2026-10-04: Dependabot fixes (PR #86: Tauri 2.11.6, Vitest 4, hono/wrangler/undici/sharp/ws/esbuild…) + CodeQL 60→1 (PR #89 merged 5179069f), codeql.yml scanning again, 5 alerts dismissed with reasons. #86 is being rebased by security-deps after #88/#89; lead merges it when clean.
- 2026-10-04: PR #86 merged after CI passed (0bdf2f65).
- 2026-10-04: ci-builds: added .github/workflows/codeql.yml in c018c3db (advanced setup; javascript-typescript, actions and rust, build-mode none; runs on push to main, on PRs and weekly). Its first run on main succeeded. It found 58 JS/TS results, 3 in the workflows (fixed in 61c41231, 0 open now) and 0 in Rust. Open JS alerts: incomplete-multi-character-sanitization 20, stack-trace-exposure 12, double-escaping 10, xss-through-dom 6, client-side-unvalidated-url-redirection 2, insecure-randomness 2, incomplete-url-substring-sanitization 2, incomplete-sanitization 2, redos 1, insufficient-password-hash 1. List them with: gh api 'repos/radio-crestin/church-hub/code-scanning/alerts?state=open&per_page=100' --paginate

## PR
- branch:
- pr:
- video:
