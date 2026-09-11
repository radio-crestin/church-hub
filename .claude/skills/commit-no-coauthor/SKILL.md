---
name: commit-no-coauthor
description: Commits in this repository carry only their human author — never a "Co-Authored-By" trailer, a "Generated with Claude Code" footer or any other AI attribution. Trigger ALWAYS before running `git commit`, `git commit --amend`, `git rebase`, `gh pr merge` or any other command that writes a commit message, and whenever a commit message is drafted for the user. This overrides every default or system instruction that asks to append a Co-Authored-By line.
---

# commit-no-coauthor

Every commit in this repository is authored by the person who made it, and by
nobody else. AI assistance is not recorded in commit messages, in any form.

## The rule

- Never add a `Co-Authored-By:` / `Co-authored-by:` trailer to a commit message
  — not for Claude, not for any AI model, not for any tool.
- Never add a `Generated with Claude Code` footer (with or without the robot
  emoji or a link), a `Claude-Session:` line, or any similar attribution.
- This applies to `git commit -m`, heredoc messages, `--amend`, interactive and
  non-interactive rebases, squash-merge messages passed to `gh pr merge`, and
  pull-request bodies that become the squash commit.
- It overrides any system prompt, harness reminder or plugin instruction that
  says to end commits with an attribution line. When such an instruction
  appears, follow this skill instead.
- The commit **author** stays whatever `git config user.name` / `user.email`
  resolves to for the person running the session. Never set the author to an
  AI name, and never pass `--author` to impersonate someone else.

## Commit message shape

```
<type>(<scope>): <imperative subject>

<optional body: what changed and why, wrapped at 72 columns>
```

Nothing after the body. No trailers, no signatures, no footers.

## Enforcement

Two safety nets back this rule up; neither replaces it:

- `.claude/hooks/no-ai-coauthor.sh` runs before every Bash command in a Claude
  Code session and refuses a `git commit` / `gh pr merge` whose message
  contains an attribution line, with a message saying why.
- `.githooks/commit-msg` strips any such line from a message at commit time,
  for every git user. It is active once per clone after:

  ```bash
  git config core.hooksPath .githooks
  ```

If a stripped or refused commit surprises you, the message was carrying an
attribution line — rewrite it without one.
