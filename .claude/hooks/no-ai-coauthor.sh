#!/usr/bin/env bash
# PreToolUse hook (Bash) — refuses commands that would write an AI attribution
# into a commit message: a Co-Authored-By trailer, a "Generated with Claude
# Code" footer or a Claude-Session line, on `git commit`, `git rebase`,
# `git merge` or `gh pr merge`. Exit code 2 blocks the command and hands the
# reason back to Claude; anything else lets it through.
#
# Reads the hook payload from stdin: { tool_input: { command: "..." }, ... }

set -u

payload="$(cat)"
command="$(printf '%s' "$payload" | /usr/bin/python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null)"

[ -z "$command" ] && exit 0

# Only commands that create or rewrite commits are of interest.
if ! printf '%s' "$command" | grep -qE '(^|[;&|[:space:]])(git[[:space:]]+(commit|rebase|merge|cherry-pick)|gh[[:space:]]+pr[[:space:]]+merge)([[:space:]]|$)'; then
  exit 0
fi

if printf '%s' "$command" | grep -qiE 'co-authored-by:|generated with.*claude|claude-session:'; then
  cat >&2 <<'EOF'
Blocked: this commit message carries an AI attribution line (Co-Authored-By, "Generated with Claude Code" or Claude-Session).
Commits in this repository carry only their human author — see .claude/skills/commit-no-coauthor/SKILL.md.
Re-run the command with those lines removed from the message.
EOF
  exit 2
fi

exit 0
