#!/usr/bin/env bash
# Publish the demos in $DEMO_OUT (default /tmp/pr-demos) for a PR description:
#   - every .gif → a GitHub prerelease asset (GitHub embeds it inline);
#   - every .mp4 → the orphan branch pr-demo-videos at <tag>/<file>, served by
#     jsDelivr as video/mp4, so a click on the GIF opens a page that plays the
#     video with its voice. Release assets would be downloaded instead
#     (content-disposition: attachment).
# Prints a "<file>\t<url>" table the caller substitutes into the PR body.
#
# Usage: upload-demos.sh <release-tag>
#   e.g. upload-demos.sh pr-demos-fix-songs-search-focus-styling

set -euo pipefail

tag="${1:-}"
[ -z "$tag" ] && { echo "usage: $0 <release-tag>" >&2; exit 1; }
# A branch like feat/x would put a slash in the asset download URL.
tag="${tag//\//-}"

src="${DEMO_OUT:-/tmp/pr-demos}"
shopt -s nullglob
gifs=("$src"/*.gif)
mp4s=("$src"/*.mp4)
if [ "${#gifs[@]}" = "0" ] && [ "${#mp4s[@]}" = "0" ]; then
  echo "no demo files (.gif/.mp4) in $src — nothing to upload" >&2
  exit 0
fi

videos_branch=pr-demo-videos
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

upload_gifs() {
  # NOT --draft: draft asset URLs return 404 for non-collaborators.
  # --prerelease keeps them out of "Latest" while remaining publicly accessible.
  if ! gh release view "$tag" >/dev/null 2>&1; then
    gh release create "$tag" --prerelease --title "$tag" --notes "PR demo videos" >/dev/null
  fi
  for gif in "${gifs[@]}"; do
    name="$(basename "$gif")"
    gh release upload "$tag" "$gif" --clobber >/dev/null
    printf '%s\thttps://github.com/%s/releases/download/%s/%s\n' "$name" "$repo" "$tag" "$name"
  done
}

# Commits the mp4s on top of the remote branch without touching the working
# tree (a private index file). Prints the commit; fails if the push is refused.
commit_mp4s() {
  local index parent tree commit
  index="$(mktemp)"
  rm -f "$index"
  parent=""
  if git fetch -q origin "$videos_branch" 2>/dev/null; then
    parent="$(git rev-parse FETCH_HEAD)"
    GIT_INDEX_FILE="$index" git read-tree "$parent"
  fi
  for mp4 in "${mp4s[@]}"; do
    blob="$(git hash-object -w "$mp4")"
    GIT_INDEX_FILE="$index" git update-index --add \
      --cacheinfo "100644,$blob,$tag/$(basename "$mp4")"
  done
  tree="$(GIT_INDEX_FILE="$index" git write-tree)"
  rm -f "$index"
  commit="$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "chore(demos): $tag videos")"
  git push -q origin "$commit:refs/heads/$videos_branch" && echo "$commit"
}

upload_mp4s() {
  local commit=""
  # Another teammate may push the branch at the same moment: retry on top of theirs.
  for _ in 1 2 3; do
    commit="$(commit_mp4s)" && break
    commit=""
  done
  [ -z "$commit" ] && { echo "error: could not push $videos_branch" >&2; exit 1; }
  for mp4 in "${mp4s[@]}"; do
    printf '%s\thttps://cdn.jsdelivr.net/gh/%s@%s/%s/%s\n' \
      "$(basename "$mp4")" "$repo" "$commit" "$tag" "$(basename "$mp4")"
  done
}

[ "${#gifs[@]}" = "0" ] || upload_gifs
[ "${#mp4s[@]}" = "0" ] || upload_mp4s
