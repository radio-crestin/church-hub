---
id: T-097
title: "Faster reviews, fewer GitHub Actions: review with a local app for this OS only; installers only on request"
kind: task
level: normal
order: -4
status: done
progress: 100
sprint: 2026-W41
createdAt: 2026-10-05T00:00:00.000Z
updatedAt: 2026-10-05T21:07:56.080Z
---

## Goal
User (2026-10-05): «in the task question, display only a copy of the build dev app on current os, don't build it fully for all the other platforms unless the user is asking for it.. https://github.com/radio-crestin/church-hub/releases/download/pr-builds/church-hub-macos-arm64-pr-132-919b627.dmg - is still returning 404.. but the goal is to speed up the review process and reduce github actions».

Why that link 404s (found by the lead): after a merge, worktree-cleanup.ts deletes the PR's installers from the pr-builds release — the link was shown in the question, then deleted once PR #132 merged.

Done means:
- pr-build.yml no longer runs on every PR push. It runs only when asked (workflow_dispatch / a PR comment such as /build, or a label), for the platforms asked; default none.
- Review = the local app built for the current OS by review-build.ts: a standalone copy (not tied to the worktree that cleanup deletes, e.g. copied to a stable review folder), and its file:// link is the one link the finishing question shows. Keep it until the task is closed, then cleanup removes it.
- .claude/rules/better-tasks.md: the lead's finishing question lists only the local app (`app:`), no `build:` installer links unless the user asked for installers for that task; teammates don't wait for pr-build (~10 min) anymore. Keep the other CI checks (Test, CodeQL, gitleaks, release-build smoke) as they are unless one is clearly redundant per PR — say which and why before removing anything.
- Update pr-build-links.sh / detailed-pr / cleanup scripts to match (no broken references).
- PR with CI green.

## Notes

- 2026-10-05: 2026-10-05 review-builds: done locally on branch chore/review-builds-on-request (worktree agent-a6d02b2ea0c119531), 4 commits: 3503ed05 pr-build only on request (/build [macos|windows|linux|all] comment or `gh workflow run pr-build.yml -f pr=<n> -f platforms=<list>`), build-desktop.yml gets a `platforms` filter (empty = all, releases/main unchanged); d02afcd0 review-build.ts puts the app in the MAIN checkout's .review-build/<task>/ (outlives the worktree; cleanup already deletes that folder) and prints the `app:` line; 371c3219 rules + detailed-pr skill + pr-build-links.sh: finishing question shows only `app:`, `build:` only when installers were asked for, nobody waits for pr-build; fecc4c90 secret-scan push trigger main only (lead approved): each PR push scanned twice before (push + pull_request); a scan after a push can't take a leak back, and the pre-commit gitleaks hook guards locally. Tested: actionlint clean; the platform-pick step and the jq filter tested locally with sample inputs; review-build.ts run from the worktree → main checkout. app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-097/church-hub-T-097.app. No video: tooling only. BLOCKED: push refused, gh token lacks the `workflow` scope (needed to change .github/workflows). The user must run `gh auth refresh -h github.com -s workflow` once; then I push and open the PR (body ready in my scratchpad pr.md). Not verifiable before merge: the /build comment trigger (issue_comment runs from main); workflow_dispatch can be tried on the branch after the push.
- 2026-10-05: User 2026-10-05 (during the GitHub Actions outage): «do the tests here and skip github actions». Don't wait for CI: check the changes locally instead (actionlint on the workflows, the scripts run by hand, review-build from a worktree, any affected tests) and put the results in the notes. That local run is the acceptance signal for merging.
- 2026-10-05: 2026-10-05 review-builds, final. PR: https://github.com/radio-crestin/church-hub/pull/134 (branch chore/review-builds-on-request). Commits: 3503ed05, d02afcd0, 371c3219, fecc4c90, 6ed0ae19. Change after the first push: the /build PR-comment trigger is REMOVED. CodeQL flagged it as critical (actions/untrusted-checkout-toctou): the job checks out the PR head after the comment, with a token that writes releases, so a push made after the comment would be built. Installers are now asked for by hand only: `gh workflow run pr-build.yml -f pr=<n>` (all three) or `-f platforms=macos,windows` (only those); rules, detailed-pr and pr-build-links.sh say so. Local checks (the user said to skip GitHub Actions; this is the acceptance signal): actionlint clean on the changed workflows (pr-build, build-desktop, secret-scan); its only findings are old shellcheck notes in build-release.yml, which I didn't touch. The platform step, run by hand: all→all 3, macos,linux→2, "Mac Win"→macos,windows, empty→all 3, ios→error. The jq platform filter in build-desktop: empty→all, macos→arm64 only, no match→error. bash -n and a real run of pr-build-links.sh 134: it prints the "ask for them: gh workflow run…" hint. biome on review-build.ts: clean. review-build.ts T-097, run from the worktree, landed in the main checkout. Real GitHub run before the outage: a Linux-only dispatch built only Linux in ~5 min and wrote the PR section: https://github.com/radio-crestin/church-hub/actions/runs/37362694181 . Secret scan now runs once per PR push (seen on the PR). CI on 6ed0ae19 was not finished because of the GitHub outage: jobs failed with "The job was not acquired by Runner of type hosted", not because of the code; the Test jobs that did run passed (unit-tests and the Windows/Ubuntu release-build smoke tests). app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-097/church-hub-T-097.app. No video: tooling only.
- 2026-10-05: User 2026-10-05 (instead of approving): «remove all unit tests, use only end to end suite, run them here locally, run the github actions on all the platforms before a release». Add to this task (same PR #134 or a follow-up PR on top, your call):
- Remove ALL unit tests (client vitest, server bun test, churchhub-backend worker tests, Rust #[test] if any) plus their config, scripts and CI jobs. The e2e suite (app/apps/client/e2e, Playwright) is the only test suite.
- Before deleting, list in the notes the critical behaviours that ONLY unit tests guard today (e.g. search ranking/FTS baselines, worker input validation, size and rate limits, secret handling, DB migrations, port/startup logic). For the security-relevant and data-loss ones, add or extend an e2e spec so they stay covered; list the rest as dropped.
- Acceptance for every task = the full e2e suite run locally, serially (CI=1 TEST_PORT=<port> --workers=1 --retries=2), results in the task notes. No GitHub Actions run on PRs or branch pushes for tests/builds.
- GitHub Actions run on all platforms (macOS, Windows, Linux: e2e + release-build smoke + builds) only before a release: wire them into the release flow (scripts/release.sh / build-release.yml) so a release is blocked unless they're green.
- Security scans: keep gitleaks on PRs (cheap; public repo, catches leaked secrets before merge) and move CodeQL to before a release (+ weekly schedule). Say so in the notes; the lead tells the user.
- Update CLAUDE.md, .claude/rules/better-tasks.md (lead: "green before asking/merging" = local full e2e green; teammates: no "CI until green" on PRs), detailed-pr and any docs that mention unit tests or PR CI.
- 2026-10-05: User 2026-10-05: «move the gitleaks as something running as a git hook on each pc, not necessary as a github action». This replaces "keep gitleaks on PRs" from the previous note:
- Remove the gitleaks GitHub workflow (secret-scan.yml) entirely.
- Gitleaks runs as a git hook on every machine: pre-commit (staged changes) and pre-push (the commits being pushed), in .githooks/ next to the existing commit-msg hook.
- Every clone gets the hooks without a manual step: set core.hooksPath=.githooks automatically (e.g. from bun install's postinstall / the setup script), on macOS, Windows (Git Bash) and Linux.
- If gitleaks isn't installed, the hook says how to install it per OS (brew / winget or scoop / apt or release binary) and blocks the commit. Never skip silently. Keep the project's .gitleaks.toml config if there is one.
- Document it in one line in the contributor docs/CLAUDE.md.
- 2026-10-05: User answers 2026-10-05: (1) the security/data-safety unit tests with no e2e equivalent (churchhub-backend worker: rate limits, size cap, XSS escaping; sync merge): «if they are not so many, keep them». Keep those few files and delete every other unit test. List the kept files in the notes. (2) Manual trial run of the pre-release gate on all 3 OSes now: «No». Wait for the first real release.
Security review of your test.yml commit (automated, MEDIUM): workflow_dispatch takes a free-form `ref` input and the job saves the bun/Playwright caches (actions/cache with broad restore-keys) that release builds restore, so a dispatched untrusted ref could poison the release caches. Fix: in test.yml use actions/cache/restore only, and save caches only on trusted refs (main/tags, no custom ref), or drop the `ref` input. Also tighten restore-keys in the release build. Details go in .claude/tasks-private/ if needed, not in the PR.
- 2026-10-05: User 2026-10-05: «Yes, update them». Approved edits to CLAUDE.md, .claude/rules/better-tasks.md, .claude/settings.json and .claude/agents/cross-platform-reviewer.md: your T-097 instructions patch, PLUS T-096's port change (merged in PR #131): the dev server/app is now at http://localhost:3001 (API docs /api/docs), the installed app stays on 3000; every "localhost:3000 / port 3000 is the user's dev server" line becomes 3001, and teammates must never touch 3000 or 3001. The exact lines are in T-096's notes. You do all the instruction-file edits (one owner for these files). Rebase on main first.
- 2026-10-06: 2026-10-06 review-builds, DONE (second scope). PR #134, branch chore/review-builds-on-request, rebased on main (PR #131 merged), head b22a27d7.
e2e: 738/738 green (0 failed, 0 retried, 34 skipped as on main), full suite run locally and serially on b22a27d7 (CI=1 TEST_PORT=3197 --workers=1 --retries=2).

Commits after the first scope:
- 2a97d5ae: gitleaks git hooks (pre-commit on staged changes, pre-push on the pushed commits); they block with per-OS install help when gitleaks is missing; bun install sets core.hooksPath; secret-scan.yml removed.
- e2e specs replacing the security/data-loss unit tests: api-auth-guards (remote 401, forged tokens, local read-only, deactivated user, non-admin, any-of permissions, background-media permissions and traversal, cross-song history restore, cookie attributes), seeded-secrets (fresh settings and fixtures hold no secret), upgrade-keeps-data (own server, restart plus legacy rows; mutation-checked), sync (change queue).
- dea76515: compiled-sidecar smoke as a script (bun run smoke:sidecar; 9/9 on macOS).
- 4125625d + 5a736b16: 196 unit test files removed, plus helpers, vitest, Rust test modules, test-only dependencies and scripts.
- be97a828: Actions only before a release. test.yml = e2e + smoke on macOS/Windows/Linux + kept unit tests; build-release.yml needs test.yml and codeql.yml (which fails on open serious alerts); no PR/push/comment test triggers; main-build by hand; release builds save the caches. Security finding fixed: no ref input; caches restore by exact key only and are saved only by main or a v* tag. Playwright webServer env/cwd made cross-platform.
- 1dcda70a: spec fixes.
- b22a27d7: user-approved instruction edits (CLAUDE.md, better-tasks rules, settings.json, cross-platform-reviewer) incl. T-096's 3001 lines.

Kept unit tests (user: keep the few): app/apps/server/src/service/sync/mergeLibraries.test.ts (16 pass; bun run test in app/apps/server), churchhub-backend/test/feature-requests.test.ts and churchhub-backend/src/utils/__tests__/escaping.test.ts (19 pass).

Dropped with no e2e:
- parseAppVersion ReDoS guard, PKCE, toSafeHttpUrl (small pure functions);
- the clearing branch of remove-seeded-secrets (needs the leaked plaintext);
- server-port defaults (would need ports 3000/3001);
- UI primitives, formatting utils, search ranking internals (partly covered by search specs).

Security, for the user: gitleaks now only on developer machines (hooks); CodeQL before each release + weekly.

Not verified: the gate on GitHub (no trial run, as the user said). e2e has never run on macOS/Windows CI, so the first release may need platform fixes; it's the first real run of codeql's release-gate on a tag ref too (it fails loudly if no analysis is found).

app: file:///Users/iosif/Documents/Projects/church-hub/.review-build/T-097/church-hub-T-097.app (built before the rebase; tooling-only change).
- 2026-10-06: Resolved by the user. Review = local app for this OS (main checkout .review-build/); installers only via gh workflow run pr-build.yml; unit tests removed except 3 kept files; acceptance = full local e2e (738/738); GitHub Actions (e2e + smoke on 3 OSes + CodeQL) gate releases only; gitleaks as pre-commit/pre-push hooks set by bun install; instructions updated (dev at 3001). PR #134 merged.
