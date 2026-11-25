#!/usr/bin/env bash
# The Linux system libraries this project needs: Playwright's browsers (WebKit's above all), at the version
# app/bun.lock pins, the Tauri shell's build libraries (WebKitGTK, tray, rodio's and the MIDI module's ALSA,
# PipeWire and libclang for the screen capture's bindgen), xdg-utils (the AppImage bundles xdg-open) and
# patchelf (compile.ts sets the sidecar's RUNPATH, or the AppImage's own patchelf corrupts it), without which
# the review build (app/scripts/review-build.ts) fails to compile or bundle the shell.
# Idempotent: only what isn't there yet, so a ready machine installs nothing. Never requires sudo:
# gitleaks goes to ~/.local/bin, and libraries apt can't install are reported as a warning.
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

# gitleaks: the pre-commit and pre-push hooks (.githooks/) run `gitleaks git`, which needs 8.19 or newer
# (Ubuntu 24.04's apt has 8.16), so it comes from the release tarball into ~/.local/bin, ahead of an older one.
gitleaks_ok() { gitleaks git --help >/dev/null 2>&1; }
install_gitleaks() {
  local bin="$HOME/.local/bin" tag="" arch
  export PATH="$bin:$PATH"
  gitleaks_ok && return 0
  # The latest tag without GitHub's API, which answers 403 once a shared network used up its
  # unauthenticated rate limit: gh when it is logged in, else the release page's redirect.
  if command -v gh >/dev/null 2>&1 && { [ -n "${GITHUB_TOKEN:-}" ] || gh auth status >/dev/null 2>&1; }; then
    tag=$(gh release view --repo gitleaks/gitleaks --json tagName -q .tagName 2>/dev/null || true)
  fi
  [ -n "$tag" ] || tag=$(curl -fsSIo /dev/null -w '%{redirect_url}' https://github.com/gitleaks/gitleaks/releases/latest | grep -oE "[0-9.]+[0-9]$")
  tag=${tag#v}
  arch=$(uname -m | sed "s/x86_64/x64/; s/aarch64/arm64/")
  mkdir -p "$bin"
  curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v$tag/gitleaks_${tag}_linux_${arch}.tar.gz" |
    tar -xz -C "$bin" gitleaks
  hash -r
  gitleaks_ok
}
# Without it the machine can still build and test, so a failed download warns instead of failing the setup.
install_gitleaks || echo "warning: could not install gitleaks 8.19+ into ~/.local/bin; the git hooks will ask for it" >&2

# Playwright's system packages. Its dry run printed one apt command up to 1.64; from 1.65 it lists
# "Missing system dependencies (N):" then one package per line and exits 1, or exits 0 when none is missing.
version=$(grep -oE '"playwright@[0-9.]+"' app/bun.lock | head -1 | grep -oE '[0-9.]+[0-9]')
# `bun x`, not bunx: a machine-wide bun may come without the bunx link.
dry_run=$(bun x "playwright@$version" install-deps --dry-run chromium webkit 2>&1 || true)
playwright=$(printf '%s\n' "$dry_run" | sed -n 's/.*--no-install-recommends \([^"]*\)".*/\1/p'
  printf '%s\n' "$dry_run" | awk '/Missing system dependencies/ { on = 1; next } on && NF == 1 && $1 ~ /^[a-z0-9][a-z0-9.+:-]+$/ { print $1 }')
tauri="build-essential pkg-config libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libasound2-dev libpipewire-0.3-dev libspa-0.2-dev libclang-dev xdg-utils patchelf"
missing=$(for pkg in $playwright $tauri; do dpkg -s "$pkg" >/dev/null 2>&1 || echo "$pkg"; done)
[ -z "$missing" ] && exit 0
# shellcheck disable=SC2086
apt_install $missing ||
  echo "warning: missing Linux system libraries (WebKit e2e and the review build need them): sudo apt-get install -y $(echo $missing)" >&2
