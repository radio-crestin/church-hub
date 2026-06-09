---
name: detailed-pr
description: Generate an extremely detailed, professional "Staff Engineer final review" Pull Request description (13-section Markdown — Summary, Why, What changed, Technical details, API changes, Database changes, Permissions/Authorization, UI/UX, Migration/Backfill, Commit breakdown, Test plan, Risks, Out of scope) grounded in the branch's REAL commits and diff, then create or update the GitHub PR with it. Use WHENEVER the user asks to create, open, make, write, refresh, or update a PR or a PR description — e.g. "fă un PR", "fă-mi un PR", "deschide un PR", "update la PR", "actualizează descrierea PR-ului", "create/open/update a PR". This is the lightweight text-only counterpart to `documented-pr` (which records GIF demos); prefer THIS one unless the user explicitly wants demo videos.
---

# detailed-pr

Produce a Pull Request description so thorough that any reviewer understands the
problem, why it mattered, the solution, the design decisions, and every
permission / migration / API / UI change — then open or update the PR with it.

The description must read as if written by the feature's **principal author**.
**Everything is grounded in the actual branch diff — never invent endpoints,
permissions, migrations, or behaviour the diff doesn't contain.**

This skill is text-only (no GIF recording). For the GIF-demo variant the user
invokes `/documented-pr` explicitly.

---

## Step 0 — Language

Default to **English content with the English section headers below** (matches
this repo's existing commits/PRs). If the user explicitly asks for Romanian,
write the prose in Romanian but **keep the English section headers**. When
unsure, check existing PRs: `gh pr list --state all --limit 5 --json title`.

---

## Step 1 — Gather the facts (run these; base them, not memory)

```bash
# Branch + base
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo main)
git fetch origin "$BASE" --quiet

# Commits, stat, files (use three-dot for "since divergence")
git log --pretty='%h %s' "origin/$BASE..HEAD"
git diff --shortstat "origin/$BASE...HEAD"
git diff --name-only "origin/$BASE...HEAD"
```

Then detect the high-signal areas the format requires a dedicated section for:

```bash
# Database: migrations + schema changes
git diff --name-only "origin/$BASE...HEAD" | grep -iE 'migration|db/schema' || true
#   → read each migration file fully (what it ALTERs/INSERTs, idempotency guard)

# Permissions: new permission keys, and whether they are NEW vs pre-existing
git diff "origin/$BASE...HEAD" | grep -E '^\+' | grep -oE "'[a-z_]+\.[a-z_]+'" | sort -u
#   for each candidate, confirm whether it already existed on the base:
#   git show "origin/$BASE:<permission-catalog-file>" | grep -c '<key>'   (>0 = pre-existing, only newly ENFORCED)

# API: new/changed endpoints (routes, handlers, openapi paths)
git diff "origin/$BASE...HEAD" | grep -E '^\+' | grep -iE "app\.(get|post|put|delete|patch)|url\.pathname ===|/api/" | head -40

# UI surfaces, new components/hooks/services
git diff --name-only "origin/$BASE...HEAD" | grep -iE 'components|hooks|service|routes' | head
```

Read the bodies of anything flagged (migrations especially). If the diff touches
**permissions, authorization, migrations, or data**, prioritise depth over
brevity in those sections — they are the highest-risk parts of any review.

If the branch is behind the base, say so; offer to merge `origin/$BASE` first
(a conflict-laden description is misleading).

---

## Step 2 — Generate the description (this EXACT 13-section format)

Write to `/tmp/pr-body.md`. Fill every section that applies; omit a section only
when the diff genuinely has nothing for it (e.g. no DB change → write
"No database changes." rather than fabricating one). Use tables where they add
clarity, hierarchical lists, and concrete examples. Group commits by theme and
cite their short hashes.

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

### Quality requirements (non-negotiable)
- No vague summaries. Deduce the architectural intent from the implemented changes.
- Explain the reasoning behind each decision.
- Tables where they increase clarity; hierarchical lists; concrete examples.
- A migration or a permission change gets a full dedicated section.
- If the PR touches permissions, authorization, or data → depth over brevity.
- Produce a description **ready to copy-paste into GitHub with no further edits**.

---

## Step 3 — Push, then create or update the PR

The branch must be on origin before the PR can reference its commits. Pushing
and PR create/edit are part of this skill's contract — **the project-wide "ask
before pushing" rule is suspended the moment the user invokes this skill**; do
not ask for confirmation.

```bash
git push -u origin "$BRANCH"

if gh pr view --json number -q .number >/dev/null 2>&1; then
  gh pr edit "$(gh pr view --json number -q .number)" --body-file /tmp/pr-body.md
  # update the title too only if the user asked or it's clearly stale:
  # gh pr edit <num> --title "<title>"
else
  gh pr create --base "$BASE" --head "$BRANCH" --title "<title>" --body-file /tmp/pr-body.md
fi
gh pr view --json url -q .url   # show the user the link
```

Title style: `<scope or domain>: <short summary>` — compact, conventional.

---

## Constraints

- **Sole author.** This user requires being the sole author. Do NOT add a
  `Co-Authored-By: Claude` trailer to any commit, and do NOT add a
  "Generated with Claude Code" footer to the PR body.
- **Grounded only.** Every claim (endpoint, permission, migration, column, file
  count) must come from the actual diff/commits. When something is uncertain,
  inspect it; do not guess.
- **Create vs update.** If a PR already exists for the branch, UPDATE it
  (`gh pr edit`); otherwise CREATE it. Never open a duplicate.
- **Push every time** before `gh pr create` / `gh pr edit`.
- **Don't pad.** Omit a section with a one-line "N/A" rather than inventing
  content to fill the template.
