#!/usr/bin/env bash
# Print the download links of a PR's installers, built only on request by
# .github/workflows/pr-build.yml (~10 min) into the shared `pr-builds` prerelease.
# The same links sit in the "Test build of <sha>" section of the PR description.
# Reviews use the local app (app/scripts/review-build.ts); installers are for
# when the user asks for them.
#
# Ask for them first: comment `/build` (all) or `/build macos windows` on the PR, or
#   gh workflow run pr-build.yml -f pr=<n> -f platforms=macos,windows,linux
#
# Usage: pr-build-links.sh <pr-number> [--wait]
#   --wait  block until the latest requested build of the PR finishes, then print.

set -euo pipefail

pr="${1:-}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "usage: $0 <pr-number> [--wait]" >&2; exit 1; }

head=$(gh pr view "$pr" --json headRefOid -q .headRefOid)
suffix="pr-$pr-${head:0:7}"

latest_run() {
  gh run list --workflow pr-build.yml --limit 30 \
    --json databaseId,displayTitle,status,conclusion,url \
    --jq "[.[] | select(.displayTitle == \"PR build #$pr\")][0]"
}

if [ "${2:-}" = "--wait" ]; then
  run_id=$(latest_run | jq -r '.databaseId // empty')
  if [ -n "$run_id" ]; then
    gh run watch "$run_id" >/dev/null 2>&1 || true
  fi
fi

links=$(gh release view pr-builds --json assets \
  --jq ".assets[] | select(.name | contains(\"$suffix\")) | \"\(.name)\t\(.url)\"" 2>/dev/null || true)

if [ -z "$links" ]; then
  echo "no installers of ${head:0:7}: ask for them with a /build comment on PR #$pr. Latest PR build run:" >&2
  latest_run | jq -r '"\(.status) \(.conclusion // "") \(.url)"' >&2
  exit 1
fi
echo "$links"
