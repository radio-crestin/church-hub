#!/usr/bin/env bash
# Release helper, in two steps, because main only takes pull requests:
#
#   1. On a branch: checks the version's release notes are written
#      (written-notes.json, the release-notes skill), bumps
#      app/tauri/tauri.conf.json, regenerates the changelog, commits and
#      pushes the branch. Open (or update) its PR and merge it.
#   2. `tag`: makes the release a pre-release draft, then tags the merged
#      commit on origin/main with the version main now carries and pushes the
#      tag.
#   3. `promote`: once the pre-release's installers were tested by hand, marks
#      it Latest, which is what the in-app updater offers (docs/auto-update.md).
#
# Before the bump it runs scripts/security-check.sh (gitleaks since the last
# tag, CodeQL locally on Linux only); any finding stops the release.
#
# CI takes over from the tag push (build-release.yml): first the pre-release
# gate — the e2e suite and the compiled-sidecar smoke on macOS, Windows and
# Linux, and CodeQL — and only if all are green it builds the installers for
# every platform, publishes the release (a pre-release stays one), then runs
# `sync-version-back` (a no-op: main already has the bump).
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
#   ./scripts/release.sh tag         # after the merge: tag origin/main, as a pre-release
#   ./scripts/release.sh promote     # after testing it: make it Latest for churches
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
  echo "usage: $0 <patch|minor|major|x.y.z|tag|promote>" >&2
  exit 1
fi

ARG="$1"

REPO=radio-crestin/church-hub

# The version origin/main carries: the one `tag` releases and `promote` ships.
main_version() {
  git -C "$REPO_ROOT" fetch -q origin main --tags
  git -C "$REPO_ROOT" show origin/main:app/tauri/tauri.conf.json \
    | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 \
    | sed -E 's/.*"([^"]*)"$/\1/'
}

confirm() {
  read -r -p "$1 [y/N] " CONFIRM
  case "$CONFIRM" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
}

# Step 2: tag the merged bump on origin/main, never a local commit. The draft
# is made first, as a pre-release: CI fills it and publishes it keeping that
# flag, so the updater never offers a release nobody has tried yet.
if [[ "$ARG" == "tag" ]]; then
  VERSION=$(main_version)
  if git -C "$REPO_ROOT" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
    echo "error: v$VERSION is already tagged: merge a bump first" >&2
    exit 1
  fi
  COMMIT=$(git -C "$REPO_ROOT" rev-parse origin/main)
  confirm "Tag v$VERSION on origin/main $(git -C "$REPO_ROOT" log -1 --format='%h %s' "$COMMIT") as a pre-release?"
  if ! gh release view "v$VERSION" --repo "$REPO" >/dev/null 2>&1; then
    gh release create "v$VERSION" --repo "$REPO" --draft --prerelease \
      --target "$COMMIT" --title "Church Hub v$VERSION" \
      --notes "Being built by CI from the v$VERSION tag."
  fi
  if [[ "$(gh release view "v$VERSION" --repo "$REPO" --json isPrerelease -q .isPrerelease)" != "true" ]]; then
    echo "error: release v$VERSION exists and is not a pre-release" >&2
    exit 1
  fi
  git -C "$REPO_ROOT" tag "v$VERSION" "$COMMIT"
  git -C "$REPO_ROOT" push origin "v$VERSION"
  echo
  echo "Tagged v$VERSION."
  echo "CI runs the pre-release gate (e2e + smoke on macOS/Windows/Linux, CodeQL);"
  echo "only if it is green, it builds every platform and publishes v$VERSION as a pre-release."
  echo "Watch: https://github.com/$REPO/actions"
  echo "Test its installers: https://github.com/$REPO/releases/tag/v$VERSION"
  echo "Then ship it to churches: ./scripts/release.sh promote"
  exit 0
fi

# Step 3: ship the tested pre-release. Latest is what releases/latest (and so
# the in-app updater's latest.json) points at.
if [[ "$ARG" == "promote" ]]; then
  VERSION=$(main_version)
  STATE=$(gh release view "v$VERSION" --repo "$REPO" \
    --json isDraft,isPrerelease,assets \
    -q '"\(.isDraft) \(.isPrerelease) \([.assets[].name] | index("latest.json") != null)"')
  case "$STATE" in
    "false true true") ;;
    "false false true") echo "v$VERSION is already Latest."; exit 0 ;;
    *)
      echo "error: v$VERSION is not a published pre-release with latest.json yet (draft, pre-release, latest.json: $STATE)" >&2
      exit 1
      ;;
  esac
  confirm "Make v$VERSION Latest, so the in-app updater offers it to every church?"
  gh release edit "v$VERSION" --repo "$REPO" --prerelease=false --latest
  SERVED=$(curl -fsSL "https://github.com/$REPO/releases/latest/download/latest.json" \
    | grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | sed -E 's/.*"([^"]*)"$/\1/')
  echo
  echo "v$VERSION is Latest; the updater's latest.json reports $SERVED."
  [[ "$SERVED" == "$VERSION" ]] || { echo "error: latest.json should report $VERSION" >&2; exit 1; }
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

# The release notes people read in the app (Settings > About, the updates
# page): written in plain English and Romanian by whoever cuts the release
# (the release-notes skill), from the commits since the last tag. No API
# key: the agent running this writes them. RELEASE_NOTES=commits releases
# with the commit list only.
NOTES_FILE="$REPO_ROOT/app/apps/client/src/features/release-notes/written-notes.json"
if [[ "${RELEASE_NOTES:-}" != "commits" ]] && ! grep -q "\"$NEW\"" "$NOTES_FILE"; then
  LAST_TAG=$(git -C "$REPO_ROOT" describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)
  echo >&2
  echo "error: no release notes for v$NEW yet." >&2
  echo "Write them in app/apps/client/src/features/release-notes/written-notes.json" >&2
  echo "(.claude/skills/release-notes/SKILL.md says how), commit, then run this again." >&2
  echo "The commits since ${LAST_TAG:-the start}:" >&2
  echo >&2
  git -C "$REPO_ROOT" log --no-merges --format='- %s' ${LAST_TAG:+"$LAST_TAG..HEAD"} >&2
  exit 1
fi

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

# No release without the security checks, run here because main's rule set
# no longer requires them on pull requests: gitleaks over every commit since
# the last tag, and CodeQL with the same suite as CI. Any finding stops it.
"$SCRIPT_DIR/security-check.sh"

confirm "Bump to v$NEW on $BRANCH?"

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
