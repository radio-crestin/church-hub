#!/usr/bin/env bash
# Print the download links of a PR's test build (made by .github/workflows/pr-build.yml
# on every push, ~25 min) into the shared `pr-builds` prerelease. The same links sit in the
# "Test build of <sha>" section of the PR description.
#
# Usage: pr-build-links.sh <pr-number> [--wait]
#   --wait  block until the build of the PR's current head finishes, then print.

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
  echo "no build of ${head:0:7} yet; latest PR build run:" >&2
  latest_run | jq -r '"\(.status) \(.conclusion // "") \(.url)"' >&2
  exit 1
fi
echo "$links"
