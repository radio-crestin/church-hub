#!/usr/bin/env bash
# The Linux system libraries this project needs: Playwright's browsers (WebKit's above all), at the version
# app/bun.lock pins, and the Tauri shell's build libraries (WebKitGTK, tray, rodio's and the MIDI module's ALSA),
# without which the review build (app/scripts/review-build.ts) fails to compile the shell.
# Idempotent: only the packages dpkg doesn't have yet, so a ready machine installs nothing.
set -euo pipefail
# apt is usable as root, or through sudo when Superfactory allows it.
if [ "$(id -u)" = 0 ]; then as_root() { "$@"; }
elif [ "${SUPERFACTORY_SETUP_SUDO:-0}" = 1 ]; then as_root() { sudo "$@"; }
else as_root() { return 1; }
fi
updated=0
apt_install() {
  # A fresh image has no package lists yet: update them first, or the install finds nothing.
  [ "$updated" = 1 ] || { as_root apt-get update -qq && updated=1; } || return 1
  DEBIAN_FRONTEND=noninteractive as_root apt-get install -y --no-install-recommends "$@"
}
# gitleaks: the pre-commit and pre-push hooks (.githooks/) refuse to run without it. Without it the
# machine can still build and test, so a failed download warns instead of failing the whole setup.
if ! command -v gitleaks >/dev/null 2>&1 && ! apt_install gitleaks 2>/dev/null; then
  # The latest release from its page's redirect: GitHub's API answers 403 once a machine's
  # address used up its unauthenticated rate limit (shared VM networks do).
  arch=$(uname -m | sed "s/x86_64/x64/; s/aarch64/arm64/")
  mkdir -p "$HOME/.local/bin"
  tag=$(curl -fsSIo /dev/null -w '%{redirect_url}' https://github.com/gitleaks/gitleaks/releases/latest | grep -oE "[0-9.]+[0-9]$") &&
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v$tag/gitleaks_${tag}_linux_${arch}.tar.gz" |
    tar -xz -C "$HOME/.local/bin" gitleaks ||
    echo "warning: could not install gitleaks; the git hooks will ask for it" >&2
fi
version=$(grep -oE '"playwright@[0-9.]+"' app/bun.lock | head -1 | grep -oE '[0-9.]+[0-9]')
# `bun x`, not bunx: a machine-wide bun may come without the bunx link.
playwright=$(bun x "playwright@$version" install-deps --dry-run chromium webkit 2>/dev/null |
  sed -n 's/.*--no-install-recommends \([^"]*\)".*/\1/p')
tauri="build-essential pkg-config libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libasound2-dev"
missing=$(for pkg in $playwright $tauri; do dpkg -s "$pkg" >/dev/null 2>&1 || echo "$pkg"; done)
[ -z "$missing" ] && exit 0
# shellcheck disable=SC2086
apt_install $missing ||
  { echo "missing Linux system libraries: sudo apt-get install -y $(echo $missing)" >&2; exit 1; }
