---
name: documented-pr
description: Create a well-documented PR in the radio-crestin/church-hub#9 style — numbered feature sections with motivation+fix+highlights, a checkbox test plan, and a per-commit Playwright-recorded GIF demo (with cursor overlay) uploaded as a GitHub prerelease asset. Use when the user wants to open or update a PR with full reviewer-friendly documentation.
disable-model-invocation: true
---

# documented-pr

You produce a PR description reviewers can act on, plus a Playwright-recorded animated GIF (with visible cursor) for every non-chore commit.

## Required defaults — non-negotiable

Every recording produced by this skill MUST use these settings; do not pare them back for any PR:

1. **1920×1080 viewport AND explicit `video.size`** — Playwright otherwise downscales to 800×600.
2. **Injected cursor overlay** — indigo dot following `mousemove` + ripple on `mousedown`, added via `page.addInitScript` in `beforeEach`. Without it the recording shows no cursor at all (Playwright videos exclude the OS pointer).
3. **`gentleClick(page, locator)` for every click** — uses `page.mouse.move(..., { steps: 25 })` so the cursor visibly travels to the target. A bare `locator.click()` teleports.
4. **Seed cursor position at test start** — `await page.mouse.move(x, y, { steps: 15 })` after the first `goto` so the cursor is visible before the first interaction.
5. **Embed via `[![alt](gif)](webm)` markdown** — `<video>` tags are stripped by GitHub's sanitizer (see next section).
6. **Auto-convert webm → gif with ffmpeg** — the `record-features.sh` script handles this; ffmpeg is a hard dependency of the skill, not optional.

The template in step 2 below already wires all six in; copy it verbatim and add `test()` cases.

## Why GIF, not `<video>` — GitHub's sanitizer (verified)

We can't embed `<video>` directly. GitHub's markdown sanitizer strips `<video>` tags from PR descriptions when the `src` is anything other than a `https://github.com/user-attachments/assets/<uuid>` URL. Confirmed empirically on PR #9: the raw markdown contained `<video src="…release/download/…webm">`, the rendered HTML (fetched via `Accept: application/vnd.github.html+json`) contained zero `<video>` elements and zero release URLs.

| What we tried | Renders inline? |
|---|---|
| `<video src="…release/download/…webm">` | No — stripped |
| `<video src="…release/download/…mp4">` | No — stripped (same allowlist) |
| `![alt](…release/download/…gif)` | **Yes** — renders as `<img data-animated-image>`, auto-plays, auto-loops |
| `<video src="…user-attachments/assets/<uuid>">` | Yes — but those URLs are only minted by web-UI drag-drop; no public REST/GraphQL endpoint |

So we transcode webm → GIF and embed via `![]()`. The webm is still uploaded as a release asset and wrapped in a clickable link around the GIF — reviewers who want pixel-perfect playback click through. Do not waste time trying `<video>` again unless GitHub publishes a user-attachments upload API.

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

[![<feature> demo](<release-asset-url>.gif)](<release-asset-url>.webm)

### 2. `<commit-prefix>(<scope>)` — <Feature title>
...

## Test plan
- [ ] **<Feature 1>:** concrete steps a reviewer can walk through.
- [ ] **<Feature 2>:** ...

## Files touched
N files, **+X / -Y**. [One sentence on the shape of the change.]
```

Each numbered section embeds its `[![…](.gif)](.webm)` block (or notes "no demo" if the commit had no UI surface). Clicking the inline GIF opens the higher-quality webm.

## Workflow

### 1. Resolve base branch and commit list

```bash
gh pr view --json baseRefName 2>/dev/null | jq -r .baseRefName  # if a PR exists
git log --reverse --format='%h %s' <base>..HEAD
```

If the branch is missing the latest `<base>`, merge it first (`git merge origin/<base>`). Default base is `main`.

### 2. Write a per-PR Playwright demo spec

Create `app/apps/client/e2e/_pr-demos.spec.ts` (the leading `_` flags it as temporary — delete after recording). The spec must:

- Lock viewport and video size to 1920×1080 (no downscaling to Playwright's 800×600 default).
- Inject a visible cursor overlay via `page.addInitScript` so clicks are observable in the recording.
- Glide the mouse in multiple steps before each click so the cursor visibly travels to its target.

Template:

```typescript
import {
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

const VIEWPORT = { width: 1920, height: 1080 }

test.use({
  viewport: VIEWPORT,
  video: { mode: 'on', size: VIEWPORT },
})

// Indigo cursor + click ripple — injected before each navigation.
const CURSOR_SCRIPT = () => {
  function inject() {
    if (document.getElementById('__pw_cursor_style')) return
    const style = document.createElement('style')
    style.id = '__pw_cursor_style'
    style.textContent = `
      @keyframes __pw_ripple {
        from { transform: scale(0.4); opacity: 0.95; }
        to   { transform: scale(2.4); opacity: 0; }
      }
      #__pw_cursor {
        position: fixed; top: 0; left: 0;
        width: 22px; height: 22px;
        border-radius: 50%;
        background: rgba(99, 102, 241, 0.9);
        box-shadow: 0 0 0 2px white, 0 0 12px rgba(0,0,0,0.45);
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-100px, -100px);
        transition: transform 0.08s ease-out;
      }
      .__pw_ripple {
        position: fixed;
        width: 48px; height: 48px;
        border-radius: 50%;
        border: 3px solid rgb(99, 102, 241);
        pointer-events: none;
        z-index: 2147483646;
        animation: __pw_ripple 0.6s ease-out forwards;
      }
    `
    document.head.appendChild(style)
    const cursor = document.createElement('div')
    cursor.id = '__pw_cursor'
    document.body.appendChild(cursor)
    document.addEventListener('mousemove', (e: MouseEvent) => {
      cursor.style.transform = `translate(${e.clientX - 11}px, ${e.clientY - 11}px)`
    }, true)
    document.addEventListener('mousedown', (e: MouseEvent) => {
      const r = document.createElement('div')
      r.className = '__pw_ripple'
      r.style.left = `${e.clientX - 24}px`
      r.style.top = `${e.clientY - 24}px`
      document.body.appendChild(r)
      setTimeout(() => r.remove(), 700)
    }, true)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject)
  } else {
    inject()
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(CURSOR_SCRIPT)
})

async function gentleClick(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  if (box) {
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 25 },
    )
    await page.waitForTimeout(180)
  }
  await locator.click()
}

// One test() per non-chore commit. Title format: "<sha-short> <feature-slug>".
// No test.describe(...) wrapper — it would prepend a slug to the test-results
// folder name and complicate the per-video filename produced by the recorder.

test('<sha-short> songs-search-styling', async ({ page }) => {
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')
  // Seed the cursor at a visible position so the viewer sees it glide to the input.
  await page.mouse.move(900, 300, { steps: 15 })
  await page.waitForTimeout(400)
  const search = page.getByPlaceholder(/caut|search/i).first()
  await expect(search).toBeVisible()
  await gentleClick(page, search)
  await page.waitForTimeout(600)
  await search.type('amazing', { delay: 80 })
  await page.waitForTimeout(1500)
})
```

Guidelines:

- **One `test()` per commit.** Name it `<short-sha> <feature-slug>` — the title becomes the output folder name, so the SHA appears in the asset URL.
- **Drive the actual code path the commit changed.** Open the relevant page/modal, perform the user gesture that exercises the diff, pause briefly so the UI renders, then assert the visible outcome.
- **Prefer text/role/placeholder selectors** over CSS classes — match the existing specs (`page.getByPlaceholder`, `page.getByRole`, `page.locator('text=...')`).
- **Use `gentleClick(page, locator)`** for every click so the cursor visibly glides to the target.
- **Seed the cursor** at the start of each test with `await page.mouse.move(x, y, { steps: 15 })` so the viewer sees it before the first interaction.
- **Skip Tauri-only behavior.** Anything that depends on a second `WebviewWindow` (auto-reopen, close-on-escape *window* side, etc.) cannot be captured in chromium. Record what is observable from the control room (settings UI, toggle state) and note in the PR body that the second-window behavior happens off-camera.
- **No `chore:` / `docs:` demos.** Skip the test for those commits and note "no demo" in the section.

### 3. Record

```bash
.claude/skills/documented-pr/scripts/record-features.sh app/apps/client/e2e/_pr-demos.spec.ts
```

The script:
1. Wipes `app/apps/client/test-results/` so we know which files are new.
2. Runs `npx playwright test _pr-demos.spec.ts --project=chromium` from the client dir.
3. Copies each `test-results/<dir>/video.webm` → `/tmp/pr-demos/<slug>.webm`.
4. Transcodes each webm → `/tmp/pr-demos/<slug>.gif` (15 fps · 1280px wide · 192-color palette · bayer dither) using ffmpeg.
5. Prints a `<slug> → <path>` table for both webms and gifs.

Requires `ffmpeg` on the PATH. On macOS: `brew install ffmpeg`. If ffmpeg is missing, the script still emits webms and prints a warning.

Recording is headless by default — no popup windows, no user interaction needed. The dev server is auto-started by `playwright.config.ts` if not already up (`reuseExistingServer: !isCI`).

### 4. Upload

```bash
.claude/skills/documented-pr/scripts/upload-demos.sh pr-demos-<branch>
```

Creates a `--prerelease` GitHub release (not `--draft`, which 404s for non-collaborators) and uploads every `.gif`, `.webm`, and `.mp4` in `/tmp/pr-demos/`. Prints `<slug> → <asset-url>` for each. The `<branch>` tag suffix lets you re-upload with `--clobber` and keep the same URLs the PR body already references.

### 5. Synthesize the PR body

For each commit, write the motivation/fix/highlights paragraph from `git show <sha>`. Use the commit's conventional-commits prefix verbatim in the section heading. Embed the demo with:

```markdown
[![<feature> demo](<url>/<slug>.gif)](<url>/<slug>.webm)
```

The outer link makes the inline GIF clickable — opens the higher-fidelity webm. Derive the Test-plan checkboxes from what the diff actually changes.

### 6. Open or update the PR

```bash
# New PR
gh pr create --title "<title>" --body "$(cat /tmp/pr-body.md)"
# Existing PR
gh pr edit <num> --body-file /tmp/pr-body.md
```

Title format: `<scope or domain>: <short summary>` — same compact style as PR #9.

Verify the GIFs actually render inline:

```bash
gh api -H 'Accept: application/vnd.github.html+json' \
  repos/<owner>/<repo>/pulls/<num> --jq '.body_html' \
  | grep -c 'data-animated-image'
```

Should equal the number of GIFs embedded. `data-animated-image=""` is the GitHub renderer's marker that the image is an animated GIF — its presence means the GIF will play in the rendered description.

### 7. Clean up

```bash
rm app/apps/client/e2e/_pr-demos.spec.ts
```

The spec was temporary; remove it so the next PR starts fresh.

## Constraints

- **Never push automatically.** Per CLAUDE.md: "NEVER push to remote unless the user explicitly asks." If the local branch isn't on the remote yet, ask before `git push -u`.
- **One test per commit; one video+gif per test.** Commits are the natural review unit.
- **Embed via `![alt](url.gif)` markdown — NOT `<video>` tags.** GitHub's sanitizer strips `<video>` tags from PR descriptions when the `src` is anything other than a `user-attachments/assets/...` URL.
- **Don't commit the videos, gifs, or the `_pr-demos.spec.ts`.** Videos live in `/tmp/pr-demos/` and end up as release assets; the spec is deleted in step 7.
- **Skip the demo for chore/docs commits** unless the user insists.
- **Keep the description grounded in what the diff actually contains** — do NOT invent test-plan items for behavior the diff doesn't touch.
