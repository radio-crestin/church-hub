#!/usr/bin/env bash
# The Linux system libraries Playwright's browsers need (WebKit's above all), at the version app/bun.lock pins.
# Idempotent: only the packages dpkg doesn't have yet, so a ready machine installs nothing.
set -euo pipefail
# gitleaks: the pre-commit and pre-push hooks (.githooks/) refuse to run without it.
if ! command -v gitleaks >/dev/null 2>&1; then
  if [ "${SUPERFACTORY_SETUP_SUDO:-0}" = 1 ] && sudo apt-get install -y gitleaks 2>/dev/null; then :
  else
    tag=$(curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/latest | grep -oE "\"tag_name\": *\"v[0-9.]+\"" | grep -oE "[0-9.]+[0-9]")
    arch=$(uname -m | sed "s/x86_64/x64/; s/aarch64/arm64/")
    mkdir -p "$HOME/.local/bin"
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v$tag/gitleaks_${tag}_linux_${arch}.tar.gz" | tar -xz -C "$HOME/.local/bin" gitleaks
  fi
fi
version=$(grep -oE '"playwright@[0-9.]+"' app/bun.lock | head -1 | grep -oE '[0-9.]+[0-9]')
wanted=$(bunx "playwright@$version" install-deps --dry-run chromium webkit 2>/dev/null |
  sed -n 's/.*--no-install-recommends \([^"]*\)".*/\1/p')
missing=$(for pkg in $wanted; do dpkg -s "$pkg" >/dev/null 2>&1 || echo "$pkg"; done)
[ -z "$missing" ] && exit 0
if [ "${SUPERFACTORY_SETUP_SUDO:-0}" = 1 ]; then
  sudo apt-get update && sudo apt-get install -y --no-install-recommends $missing
else
  echo "missing Playwright system libraries: sudo apt-get install -y $(echo $missing)" >&2; exit 1
fi
