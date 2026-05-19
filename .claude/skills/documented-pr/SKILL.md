---
name: documented-pr
description: Create a well-documented PR in the radio-crestin/church-hub#9 style — numbered feature sections with motivation+fix+highlights, a checkbox test plan, and a per-commit Playwright-recorded demo video uploaded as a GitHub prerelease asset. Use when the user wants to open or update a PR with full reviewer-friendly documentation.
disable-model-invocation: true
---

# documented-pr

You produce a PR description reviewers can act on, plus a Playwright-recorded video for every non-chore commit.

## Reference style — radio-crestin/church-hub PR #9

PR #9 is the canonical example. Match its shape:

```markdown
## Summary
[1 paragraph: what's bundled, what's bug vs feature vs polish, whether new
 architectural concepts were introduced.]

## What's in the PR

### 1. `<commit-prefix>(<scope>)` — <Feature title>
[Bug or motivation paragraph (if a fix). Then fix/implementation. Then
 "Implementation highlights:" bullets covering schema, hooks, edge cases.]

<video src="<release-asset-url>" controls width="600"></video>

### 2. `<commit-prefix>(<scope>)` — <Feature title>
...

## Test plan
- [ ] **<Feature 1>:** concrete steps a reviewer can walk through.
- [ ] **<Feature 2>:** ...

## Files touched
N files, **+X / -Y**. [One sentence on the shape of the change.]
```

Each numbered section embeds its `<video>` tag (or notes "no demo" if the commit had no UI surface).

## Workflow

### 1. Resolve base branch and commit list

```bash
gh pr view --json baseRefName 2>/dev/null | jq -r .baseRefName  # if a PR exists
git log --reverse --format='%h %s' <base>..HEAD
```

If the branch is missing the latest `<base>`, merge it first (`git merge origin/<base>`). Default base is `main`.

### 2. Write a per-PR Playwright demo spec

Create `app/apps/client/e2e/_pr-demos.spec.ts` (the leading `_` flags it as temporary — delete after recording):

```typescript
import { expect, test } from '@playwright/test'

// Record every test in this file as a webm video at 1440x900.
test.use({ video: 'on', viewport: { width: 1440, height: 900 } })

// One `test()` per commit. No `test.describe(...)` wrapper — the wrapper
// slug ends up in the test-results folder name and complicates the
// per-video filename produced by record-features.sh.

test('<commit-sha-short> songs-search-styling', async ({ page }) => {
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')
  const search = page.getByPlaceholder(/caut|search/i).first()
  await search.click()
  await page.waitForTimeout(600)            // let the focus ring render
  await search.type('amazing', { delay: 80 })
  await page.waitForTimeout(1500)
})

// …one test per non-chore commit
```

Guidelines for writing scenarios:

- **One `test()` per commit.** Name it `<short-sha>  <feature-slug>` — the test title becomes the output folder name, so the SHA appears in the asset URL.
- **Drive the actual code path the commit changed.** Open the relevant page/modal, perform the user gesture that exercises the diff, pause briefly so the UI renders, then assert the visible outcome.
- **Prefer text/role/placeholder selectors** over CSS classes — match the existing specs (`page.getByPlaceholder`, `page.getByRole`, `page.locator('text=...')`).
- **Skip Tauri-only behavior.** Anything that depends on a second `WebviewWindow` (auto-reopen, close-on-escape *window* side, etc.) cannot be captured in chromium. Record what is observable from the control room (settings UI, toggle state) and note in the PR body that the second-window behavior happens off-camera.
- **No `chore:` / `docs:` demos.** Skip the test for those commits and note "no demo" in the section.

### 3. Record

```bash
.claude/skills/documented-pr/scripts/record-features.sh app/apps/client/e2e/_pr-demos.spec.ts
```

The script:
1. Wipes `app/apps/client/test-results/` so we know which files are new.
2. Runs `npx playwright test _pr-demos.spec.ts --project=chromium` from the client dir.
3. Finds every `test-results/<dir>/video.webm` and copies it into `/tmp/pr-demos/<test-title-slug>.webm`.
4. Prints a `<slug> → <path>` table.

Recording is headless by default — no popup windows, no user interaction needed. The dev server is auto-started by `playwright.config.ts` if not already up (`reuseExistingServer: !isCI`).

### 4. Upload

```bash
.claude/skills/documented-pr/scripts/upload-demos.sh pr-demos-<branch>
```

Creates a `--prerelease` GitHub release (not `--draft`, which 404s for non-collaborators) and uploads every `.webm` in `/tmp/pr-demos/`. Prints `<slug> → <asset-url>` so you can substitute into the PR body.

### 5. Synthesize the PR body

For each commit, write the motivation/fix/highlights paragraph from `git show <sha>`. Use the commit's conventional-commits prefix verbatim in the section heading. Embed the matching `<video>` tag. Derive the Test-plan checkboxes from what the diff actually changes.

### 6. Open or update the PR

```bash
# New PR
gh pr create --title "<title>" --body "$(cat /tmp/pr-body.md)"
# Existing PR
gh pr edit <num> --body "$(cat /tmp/pr-body.md)"
```

Title format: `<scope or domain>: <short summary>` — same compact style as PR #9.

### 7. Clean up

```bash
rm app/apps/client/e2e/_pr-demos.spec.ts
```

The spec was temporary; remove it so the next PR starts fresh.

## Constraints

- **Never push automatically.** Per CLAUDE.md: "NEVER push to remote unless the user explicitly asks." If the local branch isn't on the remote yet, ask before `git push -u`.
- **One test per commit; one video per test.** Commits are the natural review unit.
- **No ffmpeg.** Playwright records natively to webm — GitHub renders `<video src="*.webm">` in PR bodies.
- **Don't commit the videos or the `_pr-demos.spec.ts`.** Videos live in `/tmp/pr-demos/` and end up as release assets; the spec is deleted in step 7.
- **Skip the video for chore/docs commits** unless the user insists.
- **Keep the description grounded in what the diff actually contains** — do NOT invent test-plan items for behavior the diff doesn't touch.
