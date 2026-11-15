---
id: T-090
title: "Request a feature — one screen: iPad-style markup on the screenshot, optional description and email"
kind: task
level: normal
order: 0
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T19:53:35.295Z
---

## Goal
User (2026-10-05): «make the "Propune o funcție nouă" much shorter, easier to understand.. also remove the title, simplify the screenshot, remove the title, make the description required».

Done means:
- The "Propune o funcție nouă" / "Request a feature" flow is much shorter and easier to understand: fewer steps, fewer words.
- No title field (remove it from the UI and from what is sent).
- The screenshot step is simpler.
- The description is required: Send stays disabled (with a clear hint) until it is filled.
- en + ro texts updated (ro via Codex per project rules).
- e2e spec updated and passing.

Goes together with T-073 (deploy the backend so Send actually works — the user sees that submit is not working). Same owner does both.

User decision: «let me review it before pushing to github» — commit locally on the branch, but do NOT push the branch or open a PR until the user has reviewed it. Report to the lead when ready for review.

## Notes

- 2026-10-05: Video: [T-090.mp4](../tasks_videos/T-090.mp4) (covers T-090 and T-073)
Ready for review, NOT pushed (user wants to review first). Branch feat/request-a-feature-simpler in worktree agent-a04546f79d85ace28. Commits: 2a4c2ada (UI), 98727d7d + 2cd52618 (worker, see T-073).
What changed: "Propune o funcție nouă" is now ONE screen: description first (required, focused, red *), screenshot with one red pen + Undo + Retake, email, one public-notice line, Send. No title field (not sent anymore), no Next/Back steps, no element picker, no pen colours/Clear. Send stays disabled with a hint ("Descrie ideea sau problema ca să poți trimite." / then "Introdu o adresă de e-mail validă…"). Retake opens the floating bar: take this page, or "Alt ecran sau fereastră" (system picker). Unused picker/step code deleted. en + ro texts (ro via Codex).
How to test: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app — sidebar "Propune o funcție nouă", write something, draw, Send: a real public issue is created (delete it after). e2e: cd app/apps/client && CI=1 TEST_PORT=3190 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2 → 12/12 pass.
Kept on purpose: email stays required (needed to reply). Not verified: OS screen picker inside the packaged Tauri app.
- 2026-10-05: User review 2026-10-05, changes requested: «i want to be two steps, firstly the screenshot with the drawing, make it much more intuitive and simple, allow adding notes on the screenshot.. and make the description optional, make sure to attach the notes also as text in the issue..»
So:
- Step 1: screenshot + drawing, much more intuitive and simple; the user can add text notes placed on the screenshot.
- Step 2: description (now OPTIONAL, replaces the earlier "required") + email, Send.
- The notes on the screenshot are also sent as text in the GitHub issue (worker change: redeploy the worker, check it end to end again, delete the test issue).
- T-073 is approved and closed by the user; its worker commits (98727d7d, 2cd52618) ship in this task's PR.
- Still: the user reviews again before anything is pushed. After they approve: push, PR, all checks green, then merge.
- 2026-10-05: User 2026-10-05: «but we don't see the test issues being created in https://github.com/radio-crestin/church-hub/issues». The lead checked: no feature-request issue is newer than #5 (2026-03-28), and #122 is missing (probably the deleted test issue). Find out whether a Send from the app the user runs really creates an issue: the dev app on port 3000 (main checkout, don't restart or kill it, only read its config/logs), the review app and an installed release build. Find the root cause (e.g. the local server's worker URL, a missing env var, an error that is hidden from the user) and fix it. Leave ONE test issue up so the user can see it, clearly marked as a test, and put its link in the notes; the user deletes it.
- 2026-10-05: Root cause of "no test issues on GitHub":
1) Until 2026-10-05 16:30 UTC the live worker was the July version with no /feature-requests route. Every Send from any app (installed v0.1.103, which has the feature since PR #101, dev, review) got a 404, so no request issue was ever created after #5. The app showed its generic "could not send" error.
2) After I deployed, the only Sends that reached the worker were my two e2e tests (#122 at 16:32, #124 at 16:53 UTC; the worker's per-IP quota records show nothing else). I deleted both as T-073 asked ("clean up any test issue"), so the list looked empty.
Checked, not a cause: every server build defaults to the live worker URL; the main checkout has no .env override; the local route always gets a context in the desktop app (no permission or origin check blocks it). Not checkable: the worker's past 400/429 answers (the wrangler token has no Observability scope), so a Send the worker rejected before the quota step would leave no trace.
Test issue left up for the user (delete it after looking): https://github.com/radio-crestin/church-hub/issues/127. It was sent from the app UI (branch build, two steps, one note on the screenshot), with label feature-request and the note also as text.
Round 2 (two steps, notes on the screenshot, optional description) is ready: commits 69b5de83 (client), dc919c50 (worker, deployed). e2e 14/14, worker tests 27/27. Video (1080p): [T-090.mp4](../tasks_videos/T-090.mp4). app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app
- 2026-10-05: User review round 2 (2026-10-05), changes requested: «no, use some design from ipad painting, choosing the color, make it intuitive.. allow drawing free hand, rectangle and so on, update the cursor».
So step 1 (the screenshot editor) becomes an iPad-style markup tool, like iPadOS/iOS Markup: a compact tool palette (free-hand pen, rectangle, arrow, ellipse, text note — "and so on"), a colour picker with a few clear colours, Undo, and a cursor that matches the chosen tool (pen, crosshair for shapes, text cursor for notes). Intuitive at first sight, no instructions needed. Keep: notes also sent as text in the issue, step 2 unchanged, 1080p video, user reviews before push.
- 2026-10-05: Round 3 (iPad-style markup) ready for review, NOT pushed. Commit 8e9bb7e5 (client only; the worker needs no change, notes still go as text).
What changed: step 1 has one rounded markup bar like iPad Markup: Pen, Highlighter, Rectangle, Circle, Arrow, Text note, then six colour dots (red, yellow, green, blue, black, white), then Undo. Each button names itself on hover (en + ro, ro via Codex). The cursor follows the tool: a pencil in the chosen colour for pen and highlighter, a crosshair for shapes, a text cursor for notes. Shapes are dragged out (a plain click adds nothing). Notes take the chosen colour (white/yellow get a dark outline). Retake moved next to the step title. Step 2 unchanged.
How to test: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app (Propune o funcție nouă, try each tool and colour, Continuă, Trimite creates a real public issue). e2e: cd app/apps/client && CI=1 TEST_PORT=3190 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2 → 15/15 (new test: shapes in the chosen colour, a cursor per tool).
Video: 1080p, plugin demo-video.sh --quality high, screenshots from a one-off scratchpad Playwright script (lead approved; deleted). The headless browser does not draw the mouse cursor, so the cursor per tool is proven by the e2e test, not shown in the video.
No virtual display was ever created by me. Test issue #127 is still up for the user.
- 2026-10-05: User review round 3 (2026-10-05), changes requested: «make the second step display the screenshot better». Step 1 (the markup bar) is accepted as is. In step 2, show the marked-up screenshot larger and clearer (readable at a glance, keeps its aspect ratio, nicely framed, e.g. a big preview next to or above the description, and click to enlarge), on desktop and phone widths. After this: the user reviews again, then push.
- 2026-10-05: Round 4 (step 2 shows the screenshot better) ready for review, NOT pushed. Commit 52fe1dbc (client only).
What changed: step 2 opens with the marked-up screenshot large and framed, in its own shape (no stretching), above the description and the email, about 40% of the window height on desktop. Caption: "Această captură va fi trimisă. Apasă ca s-o mărești." plus an "Editează" button that goes back to the markup (nothing lost). A click on the picture opens it full screen; a click or Escape closes only that view, not the dialog. Opening step 2 no longer scrolls the preview out of view. Works at phone width. en + ro (ro via Codex).
How to test: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app. e2e: cd app/apps/client && CI=1 TEST_PORT=3190 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2 → 16/16 (new: big preview keeps its shape, enlarge, Escape, Edit).
Video: [T-090.mp4](../tasks_videos/T-090.mp4), 1080p, --quality high (screenshots from a one-off scratchpad script, deleted).
All T-090 commits: 2a4c2ada, 98727d7d, 2cd52618, 69b5de83, dc919c50, 8e9bb7e5, 52fe1dbc. Test issue #127 is still up for the user.
- 2026-10-05: User review round 4 (2026-10-05), changes requested: «you can do it in one step.. screenshot above with the marking things and below the description.. also the email should be optional..».
So (this replaces the two-step layout from round 2):
- ONE screen: the screenshot with the markup bar (as in round 3) on top, editable right there; below it the description (optional) and the email, then Send.
- Email is now OPTIONAL too (worker must accept a request without email; redeploy and check end to end). With no email, the request just can't get a reply; say that in one short line near the field.
- Keep: notes go into the issue as text, works at phone width, 1080p video, user reviews before push.
- 2026-10-05: Round 5 (one screen, email optional) ready for review, NOT pushed. Commits 30b6b393 (worker, deployed) + 8a366331 (client).
What changed: one screen again. On top the screenshot with the markup bar from round 3 (editable right there), then "Descrie ideea sau problema (opțional)", then "Adresa ta de e-mail (opțional)" with the line "Adresa ta rămâne confidențială. Fără ea, nu îți putem răspunde.", then Trimite. At 1920×1080 everything fits without scrolling; at phone width it stacks. Send needs the screenshot or a description; a typed email must be valid ("Adresa de e-mail nu pare corectă."). Removed: step progress, Continuă/Înapoi, the step-2 preview and its full-screen view (no longer needed: the markup is on the same screen).
Worker: email optional (a given one must be valid; WhatsApp shows "-"); worker tests 28/28; redeployed, secrets still encrypted. End to end: a real Send without email from the app created issue #128 (title, label, note as text, screenshot all right); I deleted #128 and its image. #127 is still up for the user.
How to test: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app. e2e: cd app/apps/client && CI=1 TEST_PORT=3190 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2 → 15/15.
Video: [T-090.mp4](../tasks_videos/T-090.mp4), 1080p --quality high (one-off scratchpad capture script, deleted).
All T-090 commits: 2a4c2ada, 98727d7d, 2cd52618, 69b5de83, dc919c50, 8e9bb7e5, 52fe1dbc, 30b6b393, 8a366331.
- 2026-10-05: User review round 5 (2026-10-05), changes requested: «on the phone i see that the screenshot is not full width.. fix it». At phone widths the screenshot (with its markup bar) must use the full width of the dialog/screen; check on a real phone-sized viewport (e.g. 390×844 and 360×800) and in the e2e spec. Everything else from round 5 stays.
- 2026-10-05: User 2026-10-05: «rename propune o functie nou to Feedback». The sidebar entry and the dialog title "Propune o funcție nouă" / "Request a feature" become "Feedback" (en and ro both "Feedback"). Update the e2e spec too.
- 2026-10-05: Round 6 (phone full width + rename to "Feedback") ready for review, NOT pushed. Commits 128d9d17, 330fbca8, d2724a58 (client only; worker unchanged).
Root cause of the narrow phone screenshot: a phone screenshot is tall (portrait), and the canvas had a height cap (36% of the screen), so its width shrank to about 140 px. Fix: below 640 px wide the screenshot and the markup bar span the form's full width at the picture's own height; the cap stays on wider screens. Side fix: note labels were sized from the picture's width, so on a tall phone screenshot shown full width they were tiny; now they follow the longer side.
Rename: "Propune o funcție nouă" / "Request a feature" is now "Feedback" in en and ro (sidebar entry and dialog title); comments follow. Old changelog entries left as history.
Phone note: the screenshot can be about as tall as the screen; on a touch phone, scroll by dragging the bar or the fields (dragging on the picture draws).
How to test: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app. e2e: cd app/apps/client && CI=1 TEST_PORT=3190 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2 → 16/16 (new: full width at 390×844 and 360×800; the name "Feedback").
Video: [T-090.mp4](../tasks_videos/T-090.mp4), 1080p --quality high (one-off scratchpad capture script, deleted).
All T-090 commits: 2a4c2ada, 98727d7d, 2cd52618, 69b5de83, dc919c50, 8e9bb7e5, 52fe1dbc, 30b6b393, 8a366331, 128d9d17, 330fbca8, d2724a58. Test issue #127 still up for the user.
- 2026-10-05: User review round 6 (2026-10-05), changes requested: «on phone, make sure to ignore the sidebar before taking the snapshot». On phone widths, when Feedback is opened from the sidebar (drawer), the screenshot must show the page behind it: close or hide the sidebar/drawer (and any menu overlay) first, wait for it to finish animating out, then capture. Desktop behaviour unchanged. e2e check at phone width that the sidebar isn't in the screenshot. Everything else from round 6 stays.
- 2026-10-05: Round 7 (phone: no menu drawer in the screenshot) ready for review, NOT pushed. Commit 418b6876 (client only).
Root cause: on a phone, Feedback is tapped inside the menu drawer. The tap already closed the drawer, but the drawer slides out over 300 ms and the screenshot was taken at once, so it caught the drawer halfway (it covered most of the picture).
Fix: before capturing, the tool waits for running transitions and animations to finish (two frames to let the closing start, then at most 1 s; endless ones like spinners are skipped). Also applies to Retake ("Fă o captură"). Desktop: nothing is moving, so no visible change.
Test: new e2e "on a phone the screenshot shows the page, not the menu drawer" compares the captured picture with the page with the drawer closed and with it open; it must be clearly closer to the closed page. I checked it fails without the fix (the capture matched the open drawer) and passes with it. e2e 17/17.
How to test: app: file:///Users/iosif/Documents/Projects/church-hub/.claude/worktrees/agent-a04546f79d85ace28/.review-build/T-090/church-hub-T-090.app (narrow the window below 768 px, open the menu, tap Feedback). e2e: cd app/apps/client && CI=1 TEST_PORT=3190 bunx playwright test e2e/request-feature.spec.ts --workers=1 --retries=2.
Video: [T-090.mp4](../tasks_videos/T-090.mp4), 1920×1080 --quality high (phone shots centred on a landscape frame).
All T-090 commits: 2a4c2ada, 98727d7d, 2cd52618, 69b5de83, dc919c50, 8e9bb7e5, 52fe1dbc, 30b6b393, 8a366331, 128d9d17, 330fbca8, d2724a58, 418b6876. Test issue #127 still up for the user.
- 2026-10-05: User approved round 7 (2026-10-05): Mark as resolved, so the user's review-before-push is done. Next: rebase on current main (PRs #123, #125, #126, #129 merged since), push feat/request-a-feature-simpler, open the PR (detailed-pr; public repo: no secrets, account ids, internal URLs or security findings in the body), watch CI until every check is green, then report. The lead merges and closes T-090 (with T-073's commits).
- 2026-10-05: PR: https://github.com/radio-crestin/church-hub/pull/133
Rebased on main (after #123, #125, #126, #129): clean. After the rebase: e2e 17/17, worker 28/28; biome and tsc errors left are only in files this branch does not touch (same on main). Pushed as feat/request-a-feature-simpler. One pushed commit message (deploy.sh / secrets) was reworded to neutral wording before the PR (no security detail in public history); the code is identical. Branch commits now: 5eef1e91, fe97cee2, be9a72a4, 819a0e39, fb5c3300, 6c596300, 5de1445e, 00417a54, 3e5a29b9, 7fcbba3d, b6b44200, ebd24f90, 0737e086.
PR body: detailed-pr sections, the overview video (main's flow before vs Feedback after, 1920×1080 high) attached. /test commented to start the Test workflow; watching CI.
- 2026-10-05: CI: https://github.com/radio-crestin/church-hub/actions/runs/37361505229 (full Test run for head 2f491ac7, after rebasing on main with #132; no conflicts): gate, unit-tests, server-tests, e2e-tests and the release-build smoke test on ubuntu, windows and macos all success; only report-status was still queued (runner backlog). PR #133 checks on 2f491ac7: CodeQL (actions, js/ts, rust), gitleaks, and pr-build plan + macOS/Windows/Linux installers all pass. PR mergeable. The pr-build "comment" job (writes the installer links into the PR body) was cancelled; I re-ran only that job once, and it is queued. Until it runs, the body still links the 0737e08 installers. Per the lead: no more re-runs or Test runs. The lead merges.
PR: https://github.com/radio-crestin/church-hub/pull/133
- 2026-10-05: Resolved by the user. "Feedback" (was "Propune o funcție nouă") is one screen: iPad-style markup (pen, highlighter, shapes, arrow, text notes, 6 colours, per-tool cursor) on the screenshot, then optional description and email; notes go into the issue as text; full width on phones, sidebar hidden before capture. Worker deployed (no title, optional email, notes, encrypted secrets). PR #133 merged (Test run green; only the cosmetic pr-build comment job stuck in a GitHub Actions incident). Includes T-073's commits.
