#!/usr/bin/env bash
# PostToolUse hook — runs Biome --write on the edited file.
# Reads Claude Code hook payload from stdin: { tool_input: { file_path: "..." }, ... }
# Always exits 0 so a Biome failure never blocks an edit.

set -u

payload="$(cat)"
file_path="$(printf '%s' "$payload" | /usr/bin/python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"

[ -z "$file_path" ] && exit 0

# Only operate on files inside the app/ workspace (Biome lives there)
case "$file_path" in
  */church-hub/app/*) ;;
  *) exit 0 ;;
esac

# Only JS/TS/JSON sources
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json) ;;
  *) exit 0 ;;
esac

repo_root="${file_path%%/church-hub/*}/church-hub"
cd "$repo_root/app" 2>/dev/null || exit 0

# Run biome quietly; never propagate non-zero
bunx --bun biome check --write "$file_path" >/dev/null 2>&1 || true
exit 0
