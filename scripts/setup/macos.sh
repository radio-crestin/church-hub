#!/usr/bin/env bash
# gitleaks for the git hooks (.githooks): every commit and push runs it, Superfactory's own pushes too.
# Idempotent: installs only when it is missing.
set -euo pipefail
command -v gitleaks >/dev/null 2>&1 || brew install gitleaks
