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
# Requirements (the script stops with an error if one is missing):
#   - Playwright (already a dev dep of app/apps/client)
#   - ffmpeg + ffprobe (mp4, gif, voice timing). On macOS: `brew install ffmpeg`.
#   - macOS `say` — every showCaption text is read aloud into the mp4
#     (DEMO_VOICE=1, see e2e/helpers/demo-voice.ts). The GIF stays silent.
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

for tool in say ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' not found. Demo videos need macOS 'say' (voice-over) and ffmpeg (brew install ffmpeg)." >&2
    exit 1
  fi
done
export DEMO_VOICE=1

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
  voice_dir="$out_dir/${slug}.voice"
  rm -rf "$voice_dir"
  if [ -f "$(dirname "$vid")/voice-cues.tsv" ]; then
    mkdir -p "$voice_dir"
    cp "$(dirname "$vid")"/voice-* "$voice_dir/"
  fi
  echo "  $slug → $webm" >&2
done

if [ "$found" = "0" ]; then
  echo "no videos found in test-results/. Did the spec include test.use({ video: 'on' })?" >&2
  exit 1
fi

# Convert each webm → mp4 (H.264, plays everywhere) and animated GIF.
# GitHub PR descriptions strip <video> tags but embed animated GIFs via
# ![alt](url) markdown; the GIF links to the mp4.

echo "" >&2
echo "mp4s and GIFs produced:" >&2
for webm in "$out_dir"/*.webm; do
  mp4="${webm%.webm}.mp4"
  # 1280px wide · CRF 30 · faststart so the browser plays before it finishes
  # downloading. Each voice clip starts at its caption's time (adelay).
  inputs=(-i "$webm")
  filters="[0:v]scale=1280:-2[video]"
  mix=""
  clips=0
  cues="${webm%.webm}.voice/voice-cues.tsv"
  if [ -f "$cues" ]; then
    while IFS=$'\t' read -r at_ms clip; do
      clips=$((clips + 1))
      inputs+=(-i "$(dirname "$cues")/$clip")
      filters+=";[$clips:a]adelay=${at_ms}:all=1[c$clips]"
      mix+="[c$clips]"
    done < "$cues"
  fi
  audio=(-an)
  if [ "$clips" -gt 0 ]; then
    filters+=";${mix}amix=inputs=$clips:normalize=0[voice]"
    audio=(-map "[voice]" -c:a aac -b:a 96k)
  fi
  ffmpeg -y "${inputs[@]}" -filter_complex "$filters" -map "[video]" \
    -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart \
    "${audio[@]}" "$mp4" </dev/null >/dev/null 2>&1
  echo "  $(basename "$mp4") ($(du -h "$mp4" | awk '{print $1}'), $clips voice clips)" >&2
  gif="${webm%.webm}.gif"
  # 15 fps · scale to 1280px wide · 192-color palette · bayer dither for sharpness.
  ffmpeg -y -i "$webm" \
    -vf "fps=15,scale=1280:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=192[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
    -loop 0 "$gif" </dev/null >/dev/null 2>&1
  size="$(du -h "$gif" | awk '{print $1}')"
  echo "  $(basename "$gif") ($size)" >&2
done
