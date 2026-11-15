#!/usr/bin/env bash
# Release helper, in two steps, because main only takes pull requests:
#
#   1. On a branch: bumps app/tauri/tauri.conf.json, regenerates the changelog,
#      commits and pushes the branch. Open (or update) its PR and merge it.
#   2. `tag`: tags the merged commit on origin/main with the version main now
#      carries, and pushes the tag.
#
# CI takes over from the tag push (build-release.yml): first the pre-release
# gate — the e2e suite and the compiled-sidecar smoke on macOS, Windows and
# Linux, and CodeQL — and only if all are green it builds the release,
# publishes it as Latest (what the in-app updater offers, docs/auto-update.md),
# then runs `sync-version-back` (a no-op: main already has the bump).
#
# A red gate publishes nothing: fix main, then tag the next version. To catch
# a platform failure before tagging, run the gate on main first:
#   gh workflow run test.yml --ref main
#
# Usage:
#   ./scripts/release.sh patch       # 0.1.71 -> 0.1.72, on the current branch
#   ./scripts/release.sh minor       # 0.1.71 -> 0.2.0
#   ./scripts/release.sh major       # 0.1.71 -> 1.0.0
#   ./scripts/release.sh 0.1.72      # explicit version
#   ./scripts/release.sh tag         # after the merge: tag origin/main
#
# Why this exists: previously the version drift between
# `tauri.conf.json` and the tags meant local builds shipped with an
# outdated `__appVersion`. Bumping here before the tag keeps the file and
# the bundled release notes in lock-step with whatever's actually tagged.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF_FILE="$REPO_ROOT/app/tauri/tauri.conf.json"

if [[ ! -f "$CONF_FILE" ]]; then
  echo "error: $CONF_FILE not found" >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <patch|minor|major|x.y.z|tag>" >&2
  exit 1
fi

ARG="$1"

# Step 2: tag the merged bump on origin/main, never a local commit.
if [[ "$ARG" == "tag" ]]; then
  git -C "$REPO_ROOT" fetch origin main --tags
  VERSION=$(git -C "$REPO_ROOT" show origin/main:app/tauri/tauri.conf.json \
    | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 \
    | sed -E 's/.*"([^"]*)"$/\1/')
  if git -C "$REPO_ROOT" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
    echo "error: v$VERSION is already tagged: merge a bump first" >&2
    exit 1
  fi
  COMMIT=$(git -C "$REPO_ROOT" rev-parse origin/main)
  read -r -p "Tag v$VERSION on origin/main $(git -C "$REPO_ROOT" log -1 --format='%h %s' "$COMMIT")? [y/N] " CONFIRM
  case "$CONFIRM" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
  git -C "$REPO_ROOT" tag "v$VERSION" "$COMMIT"
  git -C "$REPO_ROOT" push origin "v$VERSION"
  echo
  echo "Tagged v$VERSION."
  echo "CI runs the pre-release gate (e2e + smoke on macOS/Windows/Linux, CodeQL);"
  echo "the release is built and published as Latest only if it is green."
  echo "Watch: https://github.com/radio-crestin/church-hub/actions"
  echo "Check: gh release list -L 3"
  exit 0
fi

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

# The bump goes in through a pull request: main's rule set refuses pushes.
BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" ]]; then
  echo "error: main only takes pull requests: bump on a branch (git switch -c release/v$NEW)" >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "error: working tree not clean — commit or stash first" >&2
  exit 1
fi

read -r -p "Bump to v$NEW on $BRANCH? [y/N] " CONFIRM
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

# Commit and push the branch; the tag comes after the merge (step 2).
git -C "$REPO_ROOT" add \
  app/tauri/tauri.conf.json \
  CHANGELOG.md \
  app/apps/client/src/features/release-notes/changelog.generated.json
git -C "$REPO_ROOT" commit -m "chore: bump version to $NEW"
git -C "$REPO_ROOT" push -u origin "$BRANCH"

echo
echo "Bumped to v$NEW on $BRANCH."
echo "Merge its pull request, then tag it: ./scripts/release.sh tag"
