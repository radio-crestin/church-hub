---
id: T-064
title: Find leaked AI API keys (OpenRouter, OpenAI, Anthropic, Gemini…) in the public repo and builds
sprint: 2026-09-28
urgent: true
status: doing
owner: secrets-audit
rolled: 0
order: -19
created: 2026-10-04
---
## Goal
User 2026-10-04: "make sure that openrouter or ai api tokens are not included in the open source github, or in the fixtures database and so on, if they are found we must invalidate them".
Scan everywhere a key could leak publicly: all git history on all branches and tags (incl. pr-demo-videos), SQLite/JSON fixtures and seed/test databases (e2e fixtures, test DBs, any .db/.sqlite in the repo or history), default settings/seed code, CI logs/workflow files, release + pr-build-* assets (installers may bundle a seed DB), demo videos/GIFs (a Settings page showing a key), PR bodies/comments. Use gitleaks/trufflehog (or equivalent) plus targeted greps for sk-or-, sk-, sk-ant-, AIza, etc., and GitHub's secret scanning alerts.
Rules: never print a full key in notes, reports or commits — mask to the first 6 + last 4 chars. Don't rewrite git history or delete releases without the lead asking the user. Invalidation/rotation is done by the user at each provider's dashboard: report per key the provider, where it was found (file/commit/asset), since when it's public, and the exact dashboard link to revoke it. Then remove keys from current files/fixtures, make sure the app never ships or seeds a real key, and add a guard (e.g. gitleaks in CI or a pre-commit hook) so it can't happen again.

## Notes
- 2026-10-04: User 2026-10-04: "but check all these exposed keys if they still work". Approved: one read-only liveness check per exposed credential found anywhere (both OpenAI keys via GET /v1/models; the leaked Live Translation stream secret via a GET of its /listen/<secret> page on churchub-backend.radiocrestin.ro; every other real secret gitleaks found). PostHog phc_ project keys are public by design — list them, no check needed. Never log or print a key; report suffix → result only.
- 2026-10-04: User 2026-10-04 (scope widened): "implement in the fixtures so that all the secret things are not part of the fixtures, including youtube tokens and oauth and so on.. it's very important to scan all of them, and if you find something, check if the keys are available and also guide me to delete each one of it, add also gitleaks to scan, including the fixtures and everything what is pushed". So: (1) fixtures/dump never include ANY secret — YouTube/Google OAuth access+refresh tokens, client secrets, OBS passwords, Google Drive tokens, stream secrets, user tokens, AI keys, any *token*/*secret*/*password*/*key* setting at any nesting level (allow-list what is safe instead of deny-listing); (2) scan ALL secret types everywhere (history, branches, tags, fixtures/DBs, releases, PR builds, videos), not only AI keys; (3) for each real one: read-only liveness check (user approved), then step-by-step guide for the user to revoke it at its provider; (4) gitleaks on every push and PR in CI (incl. fixtures and binary DB/JSON files) + pre-commit hook. Workflows: ci-builds is finished, so secrets-audit may edit .github/workflows for this (push over SSH; the gh token lacks the workflow scope).

## PR
- branch:
- pr:
- video:
