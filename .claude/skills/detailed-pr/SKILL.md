---
name: detailed-pr
description: Generate an extremely detailed, professional "Staff Engineer final review" Pull Request description (13-section Markdown — Summary, Why, What changed, Technical details, API changes, Database changes, Permissions/Authorization, UI/UX, Migration/Backfill, Commit breakdown, Test plan, Risks, Out of scope) grounded in the branch's REAL commits and diff, then create or update the GitHub PR with it. Use WHENEVER the user asks to create, open, make, write, refresh, or update a PR or a PR description — e.g. "fă un PR", "fă-mi un PR", "deschide un PR", "update la PR", "actualizează descrierea PR-ului", "create/open/update a PR".
---

# detailed-pr

Write a Pull Request description from which any reviewer understands the
problem, why it mattered, the solution, the design decisions, and every
permission / migration / API / UI change, then open or update the PR with it.
It reads as if written by the feature's principal author.

Every claim (endpoint, permission, migration, column, file count) comes from
the branch's actual commits and diff against its base (the PR's base, else
`main`): reviewers act on this text, so an invented behaviour is worse than a
missing one. When unsure, inspect the code.

A better-tasks task's PR is the plugin's short draft (its pull-request
skill); write this long form for one only when the user asks for it. When you
rewrite a body, keep its before/after video lines and its
`<!-- pr-build:start/end -->` installers block.

## Language

English prose and the English section headers below, like this repo's commits
and PRs. If the user asks for Romanian, write the prose in Romanian and keep
the English headers.

## What to look at

Besides the commit list and changed files, the high-risk areas get read in
full, not skimmed: migrations and schema files (what they alter or insert,
their idempotency guard); permission keys the diff adds, each checked against
the base's permission catalog to tell a NEW permission from an existing one
that is only newly enforced; new or changed API routes and their OpenAPI
entries. If the branch is behind its base, say so and offer to merge the base
first, since a description of a conflicting branch misleads.

## The description: 13 sections

Write to a file in your scratchpad (`pr-body.md`). A section with nothing in the diff gets a one-line
"N/A" (e.g. "No database changes."), never filler. Use tables where they add
clarity, hierarchical lists and concrete examples; group commits by theme and
cite their short hashes. Explain the reasoning behind each decision and the
architectural intent the changes show, not just what moved. Permissions, authorization, migrations and data get
depth over brevity. The result is ready to paste into GitHub as is.

```markdown
# <PR title>

### 1. Summary
Natural-language explanation of what this PR brings. If the branch contains
multiple themes/directions, enumerate them.

### 2. Why
The original problems. For EACH problem, in subsections when needed:
- the previous behaviour
- why it was wrong/problematic
- a concrete example
- the affected user flow(s)
- the impact on product / users / operations

### 3. What changed
Split by functional area (Bug fixes, Backend, Frontend, Permissions, API,
Database, Migrations, Refactors, Naming, UX). For each area: intent →
implementation → relevant side effects → backward compatibility. Reference the
relevant commit hashes, grouped by theme.

### 4. Technical details
Implementation context where useful: new services, helpers, hooks, endpoints,
queries, models, components, guards, middlewares, jobs, events, permissions,
feature flags. Use tables (e.g. | Kind | Name | Purpose |).

### 5. API changes
New endpoints, changed endpoints, request/response changes, required
permissions. Use code blocks (```http …```).

### 6. Database changes
New tables/columns/indexes/constraints/foreign-keys/backfills/migrations.
Explain compatibility and the rollback strategy clearly.

### 7. Permissions / Authorization
What permissions exist, what they grant, how they interact with existing ones,
and the migration/backward-compat strategy. Present as tables. Mark each
permission NEW vs EXISTING (newly enforced).

### 8. UI / UX changes
User-visible changes, new buttons, empty states, view cases, edit cases,
naming/label changes.

### 9. Migration / Backfill strategy
For each migration: exactly what it does, why it is safe, why it is idempotent,
and what happens if it runs again.

### 10. Commit breakdown
Themed groups, each with `<hash> <subject>`:
#### <Theme>
- `abc1234` …

### 11. Test plan
Detailed manual-validation checklist with Markdown checkboxes, covering: happy
paths, edge cases, regression, permission matrix, API validation, database
validation, migration validation, UI validation. Mark anything that can't be
reproduced in the dev/browser environment (e.g. packaged-app/WebView behaviour)
explicitly.

### 12. Risks
Potential risks across: data, permissions, performance, compatibility, UX —
each with a mitigation.

### 13. Out of scope
Explicitly list everything this PR does NOT do.
```

Title style: `<scope or domain>: <short summary>`.

## Push, then create or update the PR

Invoking this skill is the user's request to push and to create or edit the
PR, so do both without asking again: push the branch, then update its PR
(the title only if asked or clearly stale) or create one, never a duplicate,
and show the user the link. The body becomes the squash commit, so it carries
no AI attribution either (`commit-no-coauthor`).
