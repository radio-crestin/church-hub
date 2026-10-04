---
name: documented-pr
description: Create a well-documented PR in the radio-crestin/church-hub#9 style — numbered feature sections with motivation+fix+highlights, a checkbox test plan, and a per-commit Playwright-recorded demo (cursor + caption overlay + voice; inline GIF from a GitHub prerelease, linking to an mp4 played in the browser via jsDelivr). Use when the user wants to open or update a PR with full reviewer-friendly documentation.
disable-model-invocation: true
---

# documented-pr

You produce a PR description reviewers can act on, plus a Playwright-recorded demo (visible cursor, a caption per step) for every non-chore commit.

## Required defaults — non-negotiable

Every recording produced by this skill MUST use these settings; do not pare them back for any PR:

All eight come from the shared helpers `app/apps/client/e2e/helpers/demo-recording.ts` and `demo-voice.ts`; never inline a copy.

1. **1920×1080 viewport AND explicit `video.size`** — `test.use(DEMO_RECORDING)`. Playwright otherwise downscales to 800×600.
2. **Cursor + caption overlay** — `installDemoOverlay(page)` in `beforeEach`. Playwright videos exclude the OS pointer.
3. **A note per step** — `showCaption(page, '1. Open Songs')` before each gesture, so the viewer knows what they are watching.
4. **`glideClick(page, locator)` for every click** — the cursor visibly travels to the target; a bare `locator.click()` teleports.
5. **Seed cursor position at test start** — `await page.mouse.move(960, 540, { steps: 15 })` after the first `goto`.
6. **Highlight the bug or the new feature** — `highlight(page, locator, 'Bug: …')` draws a red box around it, plus a red arrow from the label; `clearHighlights(page)` removes it before the next step. Before videos box the bug, After videos box the fix or the new feature. When the element sits in the caption's band, the caption moves to the top.
7. **A voice reads every caption** — `record-features.sh` sets `DEMO_VOICE=1`; `showCaption` then has macOS `say` read the text and holds the caption until the voice ends, and the script mixes the clips into the mp4 at the caption's time. The GIF stays silent. Write captions to be heard: full words, no symbols. Another voice: `DEMO_VOICE_NAME=Ioana` (Romanian). Without `say` or ffmpeg the script stops with an error.
8. **Embed via `[![alt](gif)](mp4)` markdown** — `<video>` tags are stripped by GitHub's sanitizer (see next section). `record-features.sh` makes both with ffmpeg, a hard dependency. The mp4 link must open a player, not a download: use the jsDelivr URL `upload-demos.sh` prints (see next section).

## Why GIF, not `<video>` — GitHub's sanitizer (verified)

We can't embed `<video>` directly. GitHub's markdown sanitizer strips `<video>` tags from PR descriptions when the `src` is anything other than a `https://github.com/user-attachments/assets/<uuid>` URL. Confirmed empirically on PR #9: the raw markdown contained `<video src="…release/download/…webm">`, the rendered HTML (fetched via `Accept: application/vnd.github.html+json`) contained zero `<video>` elements and zero release URLs.

| What we tried | Renders inline? |
|---|---|
| `<video src="…release/download/…webm">` | No — stripped |
| `<video src="…release/download/…mp4">` | No — stripped (same allowlist) |
| `![alt](…release/download/…gif)` | **Yes** — renders as `<img data-animated-image>`, auto-plays, auto-loops |
| `<video src="…user-attachments/assets/<uuid>">` | Yes — but those URLs are only minted by web-UI drag-drop; no public REST/GraphQL endpoint |

So we transcode webm → GIF and embed via `![]()`, wrapped in a link to a small mp4 (H.264 + voice) — reviewers who want full-quality playback with sound click through.

Where the mp4 lives (verified 2026-10-04 in Chrome, by clicking a GIF in PR #75):

| mp4 URL | Click on the GIF |
|---|---|
| release asset `…/releases/download/…mp4` | Downloads (`content-disposition: attachment`) |
| `raw.githubusercontent.com/…mp4` | Downloads (`application/octet-stream`) |
| `github.com/…/blob/…mp4` | Page with no player |
| `cdn.jsdelivr.net/gh/<owner>/<repo>@<commit>/…mp4` | **Plays in the browser, with voice** (`video/mp4`) |

So `upload-demos.sh` commits the mp4s to the orphan branch `pr-demo-videos` and links them through jsDelivr, pinned to that commit (immutable, never a stale cache). jsDelivr needs a public repo and serves files up to 20 MB; our mp4s are under 2 MB. Do not waste time trying `<video>` again unless GitHub publishes a user-attachments upload API.

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

[![<feature> demo](<release-asset-url>.gif)](<jsdelivr-url>.mp4)

### 2. `<commit-prefix>(<scope>)` — <Feature title>
...

## Test plan
- [ ] **<Feature 1>:** concrete steps a reviewer can walk through.
- [ ] **<Feature 2>:** ...

## Files touched
N files, **+X / -Y**. [One sentence on the shape of the change.]
```

Each numbered section embeds its `[![…](.gif)](.mp4)` block (or notes "no demo" if the commit had no UI surface). Clicking the inline GIF opens the mp4.

## Workflow

### 1. Resolve base branch and commit list

```bash
gh pr view --json baseRefName 2>/dev/null | jq -r .baseRefName  # if a PR exists
git log --reverse --format='%h %s' <base>..HEAD
```

If the branch is missing the latest `<base>`, merge it first (`git merge origin/<base>`). Default base is `main`.

### 2. Write a per-PR Playwright demo spec

Create `app/apps/client/e2e/_pr-demos.spec.ts` (the leading `_` marks it temporary and gitignored — delete after recording). Template:

```typescript
import { expect, test } from '@playwright/test'

import {
  clearHighlights,
  DEMO_RECORDING,
  glideClick,
  highlight,
  installDemoOverlay,
  showCaption,
} from './helpers/demo-recording'

test.use(DEMO_RECORDING)

test.beforeEach(async ({ page }) => {
  await installDemoOverlay(page)
})

// One test() per non-chore commit. Title format: "<sha-short> <feature-slug>".
// No test.describe(...) wrapper — it would prepend a slug to the test-results
// folder name and complicate the per-video filename produced by the recorder.

test('<sha-short> songs-search-styling', async ({ page }) => {
  await page.goto('/songs')
  await page.waitForLoadState('networkidle')
  // Seed the cursor at a visible position so the viewer sees it glide to the input.
  await page.mouse.move(960, 540, { steps: 15 })
  await showCaption(page, '1. Click the song search')
  const search = page.getByPlaceholder(/caut|search/i).first()
  await expect(search).toBeVisible()
  await glideClick(page, search)
  await showCaption(page, '2. Type a title', 600)
  await search.type('amazing', { delay: 80 })
  await highlight(page, search, 'Fixed: keeps its styling')
  await showCaption(page, '3. The focused input keeps its styling', 2000)
  await clearHighlights(page)
})
```

Guidelines:

- **One `test()` per commit.** Name it `<short-sha> <feature-slug>` — the title becomes the output folder name, so the SHA appears in the asset URL.
- **Drive the actual code path the commit changed.** Open the relevant page/modal, perform the user gesture that exercises the diff, pause briefly so the UI renders, then assert the visible outcome.
- **Prefer text/role/placeholder selectors** over CSS classes — match the existing specs (`page.getByPlaceholder`, `page.getByRole`, `page.locator('text=...')`).
- **Highlight the changed element** with `highlight(page, locator, '<short label>')` while its caption shows, then `clearHighlights(page)`. Labels stay short (2–5 words): "Bug: …", "Fixed: …", "New: …".
- **Use `glideClick(page, locator)`** for every click so the cursor visibly glides to the target, and **`showCaption`** before each step.
- **Seed the cursor** at the start of each test with `await page.mouse.move(x, y, { steps: 15 })` so the viewer sees it before the first interaction.
- **Skip Tauri-only behavior.** Anything that depends on a second `WebviewWindow` (auto-reopen, close-on-escape *window* side, etc.) cannot be captured in chromium. Record what is observable from the control room (settings UI, toggle state) and note in the PR body that the second-window behavior happens off-camera.
- **No `chore:` / `docs:` demos.** Skip the test for those commits and note "no demo" in the section.

### 3. Record

```bash
DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/record-features.sh app/apps/client/e2e/_pr-demos.spec.ts
```

In a worktree prefix `CI=1 TEST_PORT=<port>` and build the client for that port first (`.claude/tasks/teammate.md`, step 2). Extra arguments go to `playwright test`.

The script:
1. Wipes `app/apps/client/test-results/` so we know which files are new.
2. Runs `npx playwright test _pr-demos.spec.ts --project=chromium` from the client dir.
3. Copies each `test-results/<dir>/video.webm` → `$DEMO_OUT/<slug>.webm` (default `/tmp/pr-demos`).
4. Transcodes each webm → `<slug>.mp4` (1280px · H.264 CRF 30 · faststart · AAC voice track from `<slug>.voice/`) and `<slug>.gif` (15 fps · 1280px wide · 192-color palette · bayer dither) using ffmpeg.
5. Prints the files with their sizes.

Requires macOS `say` and `ffmpeg`/`ffprobe` on the PATH (`brew install ffmpeg`); the script stops before recording if one is missing.

Recording is headless by default — no popup windows, no user interaction needed. The dev server is auto-started by `playwright.config.ts` if not already up (`reuseExistingServer: !isCI`); with `CI=1` it serves the prebuilt client on `TEST_PORT` with an isolated DB.

### 4. Upload

```bash
DEMO_OUT=<scratchpad>/demos .claude/skills/documented-pr/scripts/upload-demos.sh pr-demos-<branch>
```

Uploads every `.gif` in `$DEMO_OUT` to a `--prerelease` GitHub release (not `--draft`, which 404s for non-collaborators) and commits every `.mp4` to the `pr-demo-videos` branch under `<tag>/` (no working-tree change, retries if another push races it). Slashes in the tag become dashes. Prints `<file>\t<url>` for each: release URLs for GIFs, `cdn.jsdelivr.net/gh/…@<commit>/…` for mp4s. GIFs re-upload with `--clobber` to the same URL; a re-uploaded mp4 gets a new commit, so update its link.

### 5. Synthesize the PR body

For each commit, write the motivation/fix/highlights paragraph from `git show <sha>`. Use the commit's conventional-commits prefix verbatim in the section heading. Embed the demo with:

```markdown
[![<feature> demo](<gif url>)](<mp4 url>)
```

The outer link makes the inline GIF clickable — opens the mp4 in the browser's player, with voice. Derive the Test-plan checkboxes from what the diff actually changes.

### 6. Push the branch — required before opening/updating the PR

```bash
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
```

Always push before `gh pr create` or before re-running `gh pr edit` on commits the remote doesn't have yet. A PR can only reference commits that exist on origin, and a description that references local-only commits will mismatch CI runs and review comments. This step is part of the skill's contract — do it every time, do not ask for confirmation.

If the branch is in `[gone]` state (remote was deleted), recreate with the same name: `git push -u origin <branch>`.

### 7. Open or update the PR

```bash
# New PR
gh pr create --title "<title>" --body-file /tmp/pr-body.md
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

Test build: nothing to do by hand. `.github/workflows/pr-build.yml` builds macOS (Apple Silicon), Windows and Linux installers for every push (~25 min) and keeps one PR comment, "Test build of `<sha>`", linking them (assets of the `pr-build-<n>` prerelease). Get the links for the task file and the report:

```bash
.claude/skills/documented-pr/scripts/pr-build-links.sh <num> --wait   # name<TAB>url per platform
```

No build yet (PR opened before the workflow existed, or a build failed): `gh workflow run pr-build.yml -f pr=<num>`.

### 8. Clean up

```bash
rm app/apps/client/e2e/_pr-demos.spec.ts
```

The spec was temporary; remove it so the next PR starts fresh.

## Constraints

- **Push before every `gh pr create` / `gh pr edit`** (step 6). This skill's job is to ship a documented PR; that requires the branch to be on origin. The project-wide "ask before pushing" rule is suspended within this skill — you have standing authorization from the user the moment they invoke it.
- **One test per commit; one video+gif per test.** Commits are the natural review unit.
- **Embed via `![alt](url.gif)` markdown — NOT `<video>` tags.** GitHub's sanitizer strips `<video>` tags from PR descriptions when the `src` is anything other than a `user-attachments/assets/...` URL.
- **Don't commit the videos, gifs, or the `_pr-demos.spec.ts`.** Videos live in `$DEMO_OUT` and end up as release assets (GIF) and on the `pr-demo-videos` branch (mp4), never on `main`; the spec is deleted in step 7.
- **Skip the demo for chore/docs commits** unless the user insists.
- **Keep the description grounded in what the diff actually contains** — do NOT invent test-plan items for behavior the diff doesn't touch.
