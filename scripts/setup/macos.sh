#!/usr/bin/env bash
# macOS machine setup: gitleaks, which the pre-commit and pre-push hooks (.githooks/) require, from Homebrew.
# Homebrew's bin (/opt/homebrew/bin on Apple silicon, /usr/local/bin on Intel) is often missing from the PATH
# of processes launchd starts, such as Superfactory's: the hooks also look there (.githooks/require-gitleaks.sh).
# Idempotent: installs nothing when gitleaks is already there.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v gitleaks >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 || { echo "Homebrew is missing: install it from https://brew.sh" >&2; exit 1; }
  brew install gitleaks
fi
echo "gitleaks: $(command -v gitleaks)"
