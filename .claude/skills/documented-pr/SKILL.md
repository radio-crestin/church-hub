---
name: documented-pr
description: Create a well-documented PR in the radio-crestin/church-hub#9 style — numbered feature sections with motivation+fix+highlights, a checkbox test plan, and a per-commit screen-recorded demo video uploaded as a draft GitHub release. Use when the user wants to open a PR with full reviewer-friendly documentation.
disable-model-invocation: true
---

# documented-pr

You produce a PR description that reviewers can actually act on, plus a screen-recorded video demo for every feature commit.

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
N files, **+X / -Y**. [One sentence on the shape of the change — new files,
modified, removed; any breaking-change call-outs.]
```

Each numbered section MUST embed its corresponding `<video>` tag (or note "no demo" if the commit had no UI surface).

## Workflow

1. **Resolve base branch and commit list**:
   ```bash
   gh pr view --json baseRefName 2>/dev/null | jq -r .baseRefName  # if PR exists
   git log --reverse --format='%h %s' <base>..HEAD
   ```
   If no PR exists yet, default base = `main`. Confirm with the user if the current branch is unusual.

2. **For each commit (oldest → newest)**:
   - Show the commit subject + body (`git log -1 <sha>`) and the file list (`git show --stat <sha>`).
   - Ask: "Record a demo for this commit? [y / N / skip-all]"
   - If **y** → call `scripts/record-feature.sh start <sha>` (runs ffmpeg in background, returns the PID). Tell the user to demonstrate the feature in the app. When they say "done", call `scripts/record-feature.sh stop <pid>` to finalize the mp4. Path is `/tmp/pr-demos/<sha>.mp4`.
   - If **N** → note "no demo" for this commit; it will appear in the PR body without a `<video>` tag.
   - If **skip-all** → skip recording for this and every remaining commit.

3. **Synthesize the PR body** following the reference style:
   - Read each commit message and the diff (`git show <sha>`) to write the motivation/fix/highlights paragraph.
   - Use the commit's conventional-commits prefix (`feat(scope)`, `fix(scope)`, `chore`) verbatim in the section heading.
   - For the **Test plan**, derive one checkbox per commit from what the diff actually changes — concrete UI steps for UI changes, observable behavior for backend changes.
   - For **Files touched**, use the aggregate `git diff --stat <base>..HEAD` numbers.

4. **Upload videos**:
   ```bash
   scripts/upload-demos.sh <branch-or-pr-name>
   ```
   This creates a draft GitHub release `pr-demos-<branch>` and uploads every `/tmp/pr-demos/*.mp4`. Prints a `sha → asset-url` mapping you substitute into the PR body's `<video src>` attributes.

5. **Open or update the PR**:
   - New PR: `gh pr create --title "<title>" --body "$(cat /tmp/pr-body.md)"`
   - Existing PR: `gh pr edit --body "$(cat /tmp/pr-body.md)"`
   - Title format: `<scope or domain>: <short summary>` — same compact style as PR #9 ("Presentation window management & sidebar improvements").

6. **Print the PR URL** so the user can review.

## Constraints

- **Never push automatically.** Per CLAUDE.md: "NEVER push to remote unless the user explicitly asks." If the local branch isn't on the remote yet, ask before `git push -u`.
- **One mp4 per commit**, not per file. Commits are the natural review unit.
- **Keep the description grounded in what the diff actually contains** — do NOT invent test-plan items for behavior the diff doesn't touch.
- **Don't commit the mp4s into the repo.** They live in `/tmp/pr-demos/` and end up as release assets only.
- **Skip the video for commits with no UI surface** (pure refactors, dep bumps, migration-only) unless the user insists.
- If a commit subject is `chore:` or `docs:`, default to "no demo" without asking.
