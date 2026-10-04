#!/bin/sh
# Finds API-key-shaped strings that gitleaks can miss.
# Used by CI (secret-scan.yml) and by .githooks/pre-commit without gitleaks.
#
#   scripts/check-key-shapes.sh           every tracked file, binaries too
#                                         (SQLite DBs, archives stored raw)
#   scripts/check-key-shapes.sh --staged  lines added in the staged changes
#
# Prints the file names only, never the key. Exits 1 when one is found.

set -eu

key_shapes='sk-(proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|sk-or-v1-[0-9a-f]{40,}|sk-ant-[a-z0-9]{3,8}-[A-Za-z0-9_-]{40,}|AIza[0-9A-Za-z_-]{35}|gsk_[A-Za-z0-9]{40,}|xai-[A-Za-z0-9]{60,}|GOCSPX-[A-Za-z0-9_-]{20,}|ya29\.[A-Za-z0-9_-]{40,}|1//0[A-Za-z0-9_-]{40,}'

if [ "${1:-}" = "--staged" ]; then
  if git diff --cached --no-color -U0 | grep '^+' | grep -qE "$key_shapes"; then
    echo "check-key-shapes: a staged line looks like an API key or OAuth token." >&2
    exit 1
  fi
  exit 0
fi

found="$(git ls-files -z | xargs -0 grep -laE "$key_shapes" -- 2>/dev/null || true)"
if [ -n "$found" ]; then
  echo "check-key-shapes: these tracked files hold an API key or OAuth token:" >&2
  echo "$found" >&2
  exit 1
fi
echo "check-key-shapes: no key-shaped strings in tracked files"
