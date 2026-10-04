#!/usr/bin/env bash
# Run a Playwright spec and collect its per-test webm videos, plus for each a
# small mp4 (the playable video) and an animated GIF (the only moving image
# GitHub embeds inline in PR descriptions).
#
# Usage:
#   record-features.sh <spec-path-relative-to-repo> [extra playwright args]
#   e.g. record-features.sh app/apps/client/e2e/_pr-demos.spec.ts
#   In a worktree: CI=1 TEST_PORT=<port> record-features.sh <spec>
#   Output dir: $DEMO_OUT (default /tmp/pr-demos); point it at the session scratchpad.
#
# Requirements:
#   - Playwright (already a dev dep of app/apps/client)
#   - ffmpeg (for the webm → gif conversion). On macOS: `brew install ffmpeg`.
#
# The spec MUST opt into recording with `test.use({ video: 'on' })`. Each test()
# produces test-results/<dir>/video.webm. This script copies them to
# $DEMO_OUT/<slug>.webm and emits a sibling .mp4 and .gif.

set -euo pipefail

spec="${1:-}"
shift || true
if [ -z "$spec" ]; then
  echo "usage: $0 <spec-path-relative-to-repo-root>" >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
client_dir="$repo_root/app/apps/client"
out_dir="${DEMO_OUT:-/tmp/pr-demos}"
mkdir -p "$out_dir"

abs_spec="$repo_root/$spec"
if [ ! -f "$abs_spec" ]; then
  echo "error: $abs_spec does not exist" >&2
  exit 1
fi
rel_spec="${abs_spec#$client_dir/}"

cd "$client_dir"

rm -rf test-results

echo "running Playwright spec: $rel_spec" >&2
npx playwright test "$rel_spec" --project=chromium --reporter=list "$@" || {
  status=$?
  echo "warning: playwright exited with code $status; continuing to collect any videos" >&2
}

# Collect webms. Playwright names dirs <spec-stem>-<title-slug>-<project>.
echo "" >&2
echo "videos collected:" >&2
shopt -s nullglob
found=0
spec_stem="$(basename "${rel_spec%.spec.ts}")"
spec_stem_clean="${spec_stem#_}"
for vid in test-results/*/video.webm; do
  found=1
  dir_name="$(basename "$(dirname "$vid")")"
  slug="${dir_name%-chromium}"
  slug="${slug%-firefox}"
  slug="${slug%-webkit}"
  slug="${slug#${spec_stem}-}"
  slug="${slug#_${spec_stem_clean}-}"
  slug="${slug#${spec_stem_clean}-}"
  webm="$out_dir/${slug}.webm"
  cp "$vid" "$webm"
  echo "  $slug → $webm" >&2
done

if [ "$found" = "0" ]; then
  echo "no videos found in test-results/. Did the spec include test.use({ video: 'on' })?" >&2
  exit 1
fi

# Convert each webm → mp4 (H.264, plays everywhere) and animated GIF.
# GitHub PR descriptions strip <video> tags but embed animated GIFs via
# ![alt](url) markdown; the GIF links to the mp4.
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "" >&2
  echo "warning: ffmpeg not found — skipping GIF conversion. Install ffmpeg to get inline-embeddable demos." >&2
  exit 0
fi

echo "" >&2
echo "mp4s and GIFs produced:" >&2
for webm in "$out_dir"/*.webm; do
  mp4="${webm%.webm}.mp4"
  # 1280px wide · CRF 30 · faststart so the browser plays before it finishes downloading.
  ffmpeg -y -i "$webm" -vf "scale=1280:-2" -c:v libx264 -crf 30 -preset slow \
    -pix_fmt yuv420p -movflags +faststart -an "$mp4" </dev/null >/dev/null 2>&1
  echo "  $(basename "$mp4") ($(du -h "$mp4" | awk '{print $1}'))" >&2
  gif="${webm%.webm}.gif"
  # 15 fps · scale to 1280px wide · 192-color palette · bayer dither for sharpness.
  ffmpeg -y -i "$webm" \
    -vf "fps=15,scale=1280:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 "$gif" </dev/null >/dev/null 2>&1
  size="$(du -h "$gif" | awk '{print $1}')"
  echo "  $(basename "$gif") ($size)" >&2
done
