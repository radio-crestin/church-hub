---
id: T-067
title: Request a feature — screenshot first, write a note, gently encouraged to annotate; land T-001
sprint: 2026-10-05
urgent: false
status: done
owner: feature-request-2
rolled: 0
order: -1
created: 2026-10-05
---
## Goal
User 05/10: «in the task to request a feature/feedback have something like this where a screenshot is taken and the user can write something and also is encourage nicely to annotate the screenshot». Builds on T-001 (Request a feature: element picker, screenshot with drawing, notes, email → worker → GitHub issue + R2 + WhatsApp). T-001 was closed but its branch feat/request-a-feature (8 commits, last d4419a28, worktree .claude/worktrees/agent-a7afd339125c499ec) was never pushed or merged and is 132 commits behind main. Do: 1) rebase T-001's work onto main; 2) change the flow so opening "Request a feature" takes a screenshot right away and shows it with a text box to write what they want; 3) nicely encourage annotating it (a friendly hint like "Draw on the screenshot to show us where", drawing tools ready and obvious, maybe a subtle pulse on the pen tool), annotation optional; 4) one PR with T-001's work + this change. Don't deploy the worker or infra (bringes-infrastructure branch feat/waha-api-public-access) without asking the lead.

## Notes
- 2026-10-05: User 05/10 sent a reference: the ChatGPT iOS "Report app issue" sheet (image: /Users/iosif/.claude/uploads/f24a82d0-2c32-4853-b9a2-02b74deef0a1/eae38157-image.png). The sheet has a "What happened?" text box with a 0/2000 counter, a short privacy line, an "Include screenshot in report" toggle with a thumbnail of the screen, and a Send button. User: «improve it and make it more intuitive, like a short flow». So: a short, guided flow of 2–3 clear steps in this clean style, e.g. 1) screenshot shown big, with a friendly nudge to draw where; 2) "What would you like?" text box with counter + email; 3) send → thank-you. Keep the screenshot toggle, the public-issue privacy line and step progress. Fewer choices per screen, mobile responsive.
- 2026-10-05: branch: feat/request-a-feature-screenshot-first
pr: #101 https://github.com/radio-crestin/church-hub/pull/101
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@9f371cd5893123f3599dbb7097d190999ebdda9f/pr-demos-feat-request-a-feature-screenshot-first/before-pick-an-element-first-then-screenshot.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@9f371cd5893123f3599dbb7097d190999ebdda9f/pr-demos-feat-request-a-feature-screenshot-first/after-screenshot-first-then-draw-then-write.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-101/church-hub-macos-arm64-pr-101-6c64497.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-101/church-hub-windows-x64-pr-101-6c64497.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-101/church-hub-linux-x64-pr-101-6c64497.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a2eac4feeb5f7766b/.review-build/T-067/church-hub-T-067.app

Done 2026-10-05: T-001's 8 commits rebased cleanly onto main (old worktree removed, it had no uncommitted changes) plus 6c64497c: opening the tool screenshots at once; step 1 "Here is your screen" (friendly draw hint, pulsing pen until first stroke, screenshot switch, optional "point at one part"), step 2 "What would you like?" (title, notes with n / 5000, email, public notice, preview, Back/Send). Style follows the ChatGPT "Report app issue" reference. Test: CI=1 TEST_PORT=3167 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2 (all pass; includes phone width). Not verified: screenshot capture and issue opening in the packaged desktop app; worker/infra not deployed (needs lead go-ahead). The old local branch feat/request-a-feature still exists (unpushed, can be deleted).
- 2026-10-05: User review of PR #101 (request changes): «allow the user to take a screenshot on another screen or page». So from the flow the user can navigate elsewhere (another page of the app, or another screen/display window) and take/retake the screenshot there, then come back to the request.
- 2026-10-05: User 05/10 (said "PR #103", meaning this Request a feature PR #101): «improve the translations.. also replace note with describe your feature request or bug.. use codex to come up with very good romanian translations». So: rename the "Note"/notes field label to "Describe your feature request or bug" (RO via Codex), and redo all the flow's Romanian texts with Codex (teammate.md step 2, "Romanian texts via Codex"): natural for a native speaker, easy to use.
- 2026-10-05: branch: feat/request-a-feature-screenshot-first (rebased on main with #107, force-pushed with lease; head 989d7ce2)
pr: #101 https://github.com/radio-crestin/church-hub/pull/101
before: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@6eb093860cf7acdf35899f614a343de27137d8fd/pr-demos-feat-request-a-feature-screenshot-first/before-pick-an-element-first-then-screenshot.mp4
after: https://cdn.jsdelivr.net/gh/radio-crestin/church-hub@6eb093860cf7acdf35899f614a343de27137d8fd/pr-demos-feat-request-a-feature-screenshot-first/after-describe-and-retake-then-write.mp4
build: https://github.com/radio-crestin/church-hub/releases/download/pr-build-101/church-hub-macos-arm64-pr-101-989d7ce.dmg · https://github.com/radio-crestin/church-hub/releases/download/pr-build-101/church-hub-windows-x64-pr-101-989d7ce.exe · https://github.com/radio-crestin/church-hub/releases/download/pr-build-101/church-hub-linux-x64-pr-101-989d7ce.AppImage
app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a2eac4feeb5f7766b/.review-build/T-067/church-hub-T-067.app

Review rounds done 2026-10-05: (1) retake the screenshot on another page (floating bar, keeps typed text) or another screen/window (system picker via getDisplayMedia, button hidden when unsupported) = a4386392; (2) notes field is now "Describe your feature request or bug", all Romanian texts of the flow redone with Codex, sidebar label matches dialog title ("Propune o funcție nouă") = 989d7ce2. e2e request-feature.spec.ts 13/13. Not verified: OS screen picker inside the packaged Tauri app (webview may not support getDisplayMedia; the button hides if unsupported, an error line shows on failure); worker/infra still not deployed. Side effect: I overwrote part of another agent's pr-body.md in the shared scratchpad by mistake (the After section of a T-006 body); that agent should regenerate it.
- 2026-10-05: Closed by the user. Request a feature lands (T-001's work + screenshot-first 2-step flow, draw hint, retake on another page/screen, "Describe your feature request or bug", Romanian via Codex, CodeQL log fix). PR #101 merged. Worker/infra still not deployed. Old local branch feat/request-a-feature kept (rebased copy, patch ids differ).

## PR
- branch:
- pr:
- video:
