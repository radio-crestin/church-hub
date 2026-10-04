---
id: T-059
title: Fix the 81 bun audit vulnerabilities and upgrade Bun
sprint: 2026-09-28
urgent: false
status: done
owner: security-deps
rolled: 0
order: -15
created: 2026-10-04
---
## Goal
User 2026-10-04: "create a new task and take care of it now including bun". Found by security-deps during T-058: `bun audit` on app/bun.lock lists 81 vulnerabilities Dependabot doesn't report (3 critical, 31 high) — shell-quote, tar, elysia, ws, vite, axios, protobufjs, @tiptap/core, postcss and others. Several are runtime deps (elysia server, ws, axios, tiptap), so upgrades can break things.
Done when: `bun audit` is clean (or each leftover is listed with why it can't be fixed yet); Bun itself is upgraded to the latest stable everywhere it is pinned (package.json engines/packageManager, CI setup-bun, compile scripts, sidecar build) and the compiled sidecar still starts (/ping) on macOS, Windows, Linux; native modules (MIDI, audio) still load; server unit tests + main e2e specs pass serially; PR build green on all 3 OSes. Separate PR from T-058's Dependabot PR.

## Notes
- 2026-10-04: security-deps (2026-10-04): PR #88 https://github.com/radio-crestin/church-hub/pull/88. Commits 5eac4949 (bun audit fix: 20 in-range lifts; concurrently ^9.2.4, @tiptap/* ^3.31.4, ai ^5.0.207, @ai-sdk/anthropic ^3.0.89, google ^3.0.86, openai ^2.0.110; overrides @opentelemetry/core ^2.8.0, image-size ^2.0.3), 7b6c758d (merge main), 1ad5de9d (packageManager bun@1.4.2, bun-types ^1.4.2; workflow edits dropped per lead, ci-builds switches setup-bun to bun-version-file: app/package.json). bun audit 81 → 4: vitest/@vitest/mocker (fixed by PR #86) and braces 3.0.3 (no fixed release, dev-only through chokidar). Tests, all on Bun 1.4.2: server 407 pass; compiled-sidecar smoke test 4 pass; MIDI and audify load (8 devices); client unit 1375/1375; main e2e 42 pass; tiptap editor e2e 34 pass. Found, not fixed: ai 5 rejects the v3 models from @ai-sdk/anthropic 3.x and google 3.x (already so on main), so AI search with Anthropic or Gemini fails. Not verified yet: PR build on 3 OSes; CI on Bun 1.4.2 (waits on ci-builds' workflow change).
branch: fix/bun-audit-and-bun-upgrade
pr: #88 https://github.com/radio-crestin/church-hub/pull/88
before: (none, no user-visible change)
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@971a588593cf32975a76258f012ce5707db9328e/pr-demos-fix-bun-audit-and-bun-upgrade/app-still-work-1dce6-the-Bun-and-package-updates.mp4
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-add6b7e61ffd50215/.review-build/T-059/church-hub-T-059.app
- 2026-10-04: build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-88/church-hub-macos-arm64-pr-88-1ad5de9.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-88/church-hub-windows-x64-pr-88-1ad5de9.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-88/church-hub-linux-x64-pr-88-1ad5de9.AppImage (PR #88 build green on macOS, Windows, Linux at 1ad5de9)
- 2026-10-04: bun audit 81 → 4 (vitest fixed by #86; braces dev-only, no fix). Bun pinned 1.4.2 in app/package.json; OpenAI AI search fixed. PR #88 merged (a3488004).

## PR
- branch:
- pr:
- video:
