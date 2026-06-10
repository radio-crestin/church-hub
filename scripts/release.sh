#!/usr/bin/env bash
# Release helper — bumps app/tauri/tauri.conf.json, commits, tags, pushes.
# CI takes over from the tag push: it builds the release artifacts and
# then runs `sync-version-back` to commit the bump back to `main` (which
# is a no-op here because this script already did it locally).
#
# Usage:
#   ./scripts/release.sh patch       # 0.1.71 -> 0.1.72
#   ./scripts/release.sh minor       # 0.1.71 -> 0.2.0
#   ./scripts/release.sh major       # 0.1.71 -> 1.0.0
#   ./scripts/release.sh 0.1.72      # explicit version
#
# Why this exists: previously the version drift between
# `tauri.conf.json` and the tags meant local builds shipped with an
# outdated `__appVersion`. Running this script + letting CI sync the
# bump back keeps the file in lock-step with whatever's actually tagged.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF_FILE="$REPO_ROOT/app/tauri/tauri.conf.json"

if [[ ! -f "$CONF_FILE" ]]; then
  echo "error: $CONF_FILE not found" >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <patch|minor|major|x.y.z>" >&2
  exit 1
fi

ARG="$1"

# Read current version with a portable regex (works on macOS bsd-sed +
# GNU sed without depending on `jq`).
CURRENT=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONF_FILE" \
  | head -1 \
  | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')

if [[ -z "$CURRENT" ]]; then
  echo "error: could not read current version from $CONF_FILE" >&2
  exit 1
fi

echo "Current version: $CURRENT"

# Compute the new version.
case "$ARG" in
  patch|minor|major)
    IFS='.' read -r MAJ MIN PAT <<<"$CURRENT"
    case "$ARG" in
      patch) PAT=$((PAT + 1)) ;;
      minor) MIN=$((MIN + 1)); PAT=0 ;;
      major) MAJ=$((MAJ + 1)); MIN=0; PAT=0 ;;
    esac
    NEW="$MAJ.$MIN.$PAT"
    ;;
  *)
    # Explicit version. Reject anything that isn't bare semver — the
    # sync-version-back job strips pre-release suffixes anyway, but we
    # want the local commit to be unambiguous.
    if [[ ! "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "error: '$ARG' is not a valid x.y.z version" >&2
      exit 1
    fi
    NEW="$ARG"
    ;;
esac

if [[ "$NEW" == "$CURRENT" ]]; then
  echo "Nothing to do — version is already $NEW."
  exit 0
fi

echo "New version:     $NEW"

# Refuse to bump unless we're on main with a clean working tree —
# releasing from a feature branch silently drifts the tags and that's
# exactly the problem this script exists to prevent.
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "error: refusing to release from '$BRANCH' (expected 'main')" >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "error: working tree not clean — commit or stash first" >&2
  exit 1
fi

read -r -p "Cut release v$NEW? [y/N] " CONFIRM
case "$CONFIRM" in
  y|Y|yes|YES) ;;
  *) echo "aborted"; exit 1 ;;
esac

# Patch the file in place.
if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' -E "s/(\"version\"[[:space:]]*:[[:space:]]*)\"[^\"]*\"/\1\"$NEW\"/" "$CONF_FILE"
else
  sed -i -E "s/(\"version\"[[:space:]]*:[[:space:]]*)\"[^\"]*\"/\1\"$NEW\"/" "$CONF_FILE"
fi

# Regenerate the changelog (CHANGELOG.md + bundled changelog.json) from git
# history. Runs *after* the version bump but *before* the tag, so the top
# entry captures the new version and the shipping build bundles its own notes.
echo "Regenerating changelog..."
bun "$REPO_ROOT/app/scripts/generate-changelog.ts"

# Commit, tag, push. The tag push triggers CI which builds + releases +
# auto-syncs (no-op here because we already committed).
git -C "$REPO_ROOT" add \
  app/tauri/tauri.conf.json \
  CHANGELOG.md \
  app/apps/client/src/features/release-notes/changelog.generated.json
git -C "$REPO_ROOT" commit -m "chore: bump version to $NEW"
git -C "$REPO_ROOT" tag "v$NEW"
git -C "$REPO_ROOT" push origin main
git -C "$REPO_ROOT" push origin "v$NEW"

echo
echo "Released v$NEW."
echo "CI will pick up the tag and build the artifacts."
echo "Watch: https://github.com/radio-crestin/church-hub/actions"
