---
id: T-080
title: "Fix or close GitHub issue #118 — CI failing on main or a release"
sprint: 2026-10-05
urgent: false
status: done
owner: ci
rolled: 0
order: -2
created: 2026-10-05
---
## Goal
User's words: "also fix https://github.com/radio-crestin/church-hub/issues/118 or close.."

Issue #118: "CI is failing on main or a release" (open).

What to do:
- Read the issue and the failing runs it points to; check whether CI on main and the latest release is still red now.
- Still failing → find the root cause, fix it properly (no skipped tests, no retries to hide it), PR per the project rules, CI green.
- Already fixed or stale → close the issue with a short comment linking the green run / fixing commit.
- This may block T-078 (pre-release build with everything on main): keep that in mind.

Done = CI green on main (run link in the notes) and issue #118 closed, or a PR with the fix ready for review.

## Notes
- 2026-10-05: 2026-10-05 Root cause: Test on main red since 9e0ea66 (runs 37305530609, 37306047416, 37306774054, 37306862880): always the same 3 tests in e2e/song-text-mode-scroll.spec.ts (701 passed, 3 failed, all retries). Not flaky: locator('textarea.font-mono') now matches 2 elements because the song page also mounts the closed Marcaje text dialog (EditSongBookmarksTextModal, 5c1a6e08), whose textarea is font-mono too -> Playwright strict-mode violation. App is fine.
Fix: data-testid="slides-text-textarea" on the song text-mode textarea (SongSlidesPanel.tsx) + spec uses getByTestId. Commit 21cb3760 on fix/song-text-mode-spec-locator. Reproduced 3 failures locally before, 5/5 pass after (CI=1 TEST_PORT=3180, --workers=1 --retries=2). Biome clean.
PR: https://github.com/radio-crestin/church-hub/pull/119
Full Test run on the branch: https://github.com/radio-crestin/church-hub/actions/runs/37309528852 (pending at time of note).
app: none built (no user-visible change; only a test attribute). build: pr-build CI for #119.
Issue #118 stays open until #119 is merged and main's Test is green; it should then be closed citing that run.
- 2026-10-05: User 2026-10-05 (applies to every PR from now): watch the tests and fix everything before asking for approval and before merging. So: report T-080 done only when every CI check on your PR is green (link the green runs in the notes); any red check → fix the root cause, push, watch again. After T-080 merges, T-078 cuts the pre-release.
- 2026-10-05: All checks on PR #119 are green. Full Test run on the branch passed, including e2e: https://github.com/radio-crestin/church-hub/actions/runs/37309528852. The PR checks also pass: CodeQL https://github.com/radio-crestin/church-hub/actions/runs/37309513288, PR build (3 OS) https://github.com/radio-crestin/church-hub/actions/runs/37309513757, gitleaks https://github.com/radio-crestin/church-hub/actions/runs/37309513437. Test is workflow_dispatch, so it is not listed among the PR checks.
How to test: cd app/apps/client && CI=1 TEST_PORT=<port> bunx playwright test e2e/song-text-mode-scroll.spec.ts --workers=1 --retries=2 (5/5).
Not verified: Test on main after the merge. After merging, wait for main's Test run to go green, then close #118 with a comment linking that run and PR #119.
- 2026-10-05: Test on main was red: song-text-mode spec matched two font-mono textareas (closed Marcaje dialog); textarea got a test id. PR #119 merged (5677a3eb). Closing #118 after main's Test passes is handed to T-078.
