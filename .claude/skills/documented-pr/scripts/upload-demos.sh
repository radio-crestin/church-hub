#!/usr/bin/env bash
# Upload all mp4s in /tmp/pr-demos/ to a draft GitHub release.
# Prints a sha→url table the caller substitutes into the PR body.
#
# Usage: upload-demos.sh <release-tag>
#   e.g. upload-demos.sh pr-demos-feat-something

set -euo pipefail

tag="${1:-}"
[ -z "$tag" ] && { echo "usage: $0 <release-tag>" >&2; exit 1; }

src="/tmp/pr-demos"
if ! compgen -G "$src/*.mp4" > /dev/null; then
  echo "no mp4s in $src — nothing to upload" >&2
  exit 0
fi

# Create (or reuse) a prerelease. NOT --draft: draft asset URLs return 404
# for non-collaborators, breaking <video> tags for external PR reviewers.
# --prerelease keeps them out of the "Latest" release while remaining public.
if gh release view "$tag" >/dev/null 2>&1; then
  echo "release $tag already exists — uploading additional assets"
else
  gh release create "$tag" --prerelease --title "$tag" --notes "PR demo videos" >/dev/null
fi

# Upload each mp4 (--clobber to replace if re-running)
for f in "$src"/*.mp4; do
  name="$(basename "$f")"
  gh release upload "$tag" "$f" --clobber >/dev/null
  # Resolve to the final asset URL via API
  url=$(gh release view "$tag" --json assets \
        --jq ".assets[] | select(.name==\"$name\") | .url")
  echo "${name%.mp4}	$url"
done
