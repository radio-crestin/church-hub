#!/usr/bin/env bash
# Run a Playwright spec and collect its per-test webm videos into /tmp/pr-demos/.
#
# Usage:
#   record-features.sh <spec-path-relative-to-repo>
#   e.g. record-features.sh app/apps/client/e2e/_pr-demos.spec.ts
#
# The spec MUST opt into recording with `test.use({ video: 'on' })`.
# Each test() produces test-results/<spec>-<title-slug>-<project>/video.webm.
# This script copies them all to /tmp/pr-demos/<title-slug>.webm (project suffix stripped).

set -euo pipefail

spec="${1:-}"
if [ -z "$spec" ]; then
  echo "usage: $0 <spec-path-relative-to-repo-root>" >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
client_dir="$repo_root/app/apps/client"
out_dir="/tmp/pr-demos"
mkdir -p "$out_dir"

# Convert spec path to one relative to the client dir for Playwright.
abs_spec="$repo_root/$spec"
if [ ! -f "$abs_spec" ]; then
  echo "error: $abs_spec does not exist" >&2
  exit 1
fi
rel_spec="${abs_spec#$client_dir/}"

cd "$client_dir"

# Clean previous results so we only collect this run's videos.
rm -rf test-results

# Reuse the existing dev server if one is up; otherwise playwright.config.ts will
# spawn `bun run dev:web` for us.
echo "running Playwright spec: $rel_spec" >&2
npx playwright test "$rel_spec" --project=chromium --reporter=list || {
  status=$?
  # Even on failure Playwright still writes videos for completed steps — keep going.
  echo "warning: playwright exited with code $status; continuing to collect any videos" >&2
}

# Collect videos. Test directory names are typically:
#   <spec-stem>-<describe-slug>-<title-slug>-<project>
# Strip the trailing -<project> and "_pr-demos-" / "PR-demos-" prefix so the slug
# stays close to the test title (which usually starts with the commit SHA).
echo "" >&2
echo "videos collected:" >&2
shopt -s nullglob
found=0
for vid in test-results/*/video.webm; do
  found=1
  dir_name="$(basename "$(dirname "$vid")")"
  slug="${dir_name%-chromium}"
  slug="${slug%-firefox}"
  slug="${slug%-webkit}"
  # Drop the leading "<spec-stem>-" prefix so the filename is just the test title slug.
  spec_stem="$(basename "${rel_spec%.spec.ts}")"
  spec_stem="${spec_stem#_}"
  slug="${slug#${spec_stem}-}"
  slug="${slug#_${spec_stem}-}"
  target="$out_dir/${slug}.webm"
  cp "$vid" "$target"
  echo "  $slug → $target" >&2
done

if [ "$found" = "0" ]; then
  echo "no videos found in test-results/. Did the spec include test.use({ video: 'on' })?" >&2
  exit 1
fi
