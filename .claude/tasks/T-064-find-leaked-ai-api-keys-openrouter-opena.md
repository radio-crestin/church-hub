---
id: T-064
title: Find leaked AI API keys (OpenRouter, OpenAI, Anthropic, Gemini…) in the public repo and builds
sprint: 2026-09-28
urgent: false
status: done
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
- 2026-10-04: Details are kept in the private task notes (.claude/tasks-private/, not in git).

## PR
- branch:
- pr:
- video:
