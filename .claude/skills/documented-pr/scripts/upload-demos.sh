#!/usr/bin/env bash
# Upload every video in /tmp/pr-demos/ to a GitHub prerelease.
# Prints a slug→url table the caller substitutes into the PR body.
#
# Usage: upload-demos.sh <release-tag>
#   e.g. upload-demos.sh pr-demos-fix-songs-search-focus-styling

set -euo pipefail

tag="${1:-}"
[ -z "$tag" ] && { echo "usage: $0 <release-tag>" >&2; exit 1; }

src="/tmp/pr-demos"
shopt -s nullglob
videos=("$src"/*.webm "$src"/*.mp4)
if [ "${#videos[@]}" = "0" ]; then
  echo "no videos in $src — nothing to upload" >&2
  exit 0
fi

# Create (or reuse) a prerelease. NOT --draft: draft asset URLs return 404
# for non-collaborators, breaking <video> tags for external PR reviewers.
# --prerelease keeps them out of "Latest" while remaining publicly accessible.
if gh release view "$tag" >/dev/null 2>&1; then
  echo "release $tag already exists — uploading additional assets" >&2
else
  gh release create "$tag" --prerelease --title "$tag" --notes "PR demo videos" >/dev/null
fi

for f in "${videos[@]}"; do
  name="$(basename "$f")"
  gh release upload "$tag" "$f" --clobber >/dev/null
  url=$(gh release view "$tag" --json assets \
        --jq ".assets[] | select(.name==\"$name\") | .url")
  # Strip extension for the slug column
  slug="${name%.*}"
  printf '%s\t%s\n' "$slug" "$url"
done
