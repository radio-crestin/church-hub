#!/usr/bin/env bash
set -e

if [ ! -f .prod.vars ]; then
  echo "ERROR: .prod.vars not found (create it next to deploy.sh)." >&2
  exit 1
fi

source .prod.vars

# Every deploy REPLACES the worker's vars wholesale — a missing value here
# would silently wipe it in production (this exact failure once emptied
# ALLOWED_ORIGINS and broke all OAuth). Refuse to deploy incomplete.
REQUIRED_VARS=(
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET
  YOUTUBE_REDIRECT_URI
  COOKIE_ENCRYPTION_KEY
  ALLOWED_ORIGINS
  GITHUB_TOKEN
)
MISSING=()
for v in "${REQUIRED_VARS[@]}"; do
  [ -n "${!v:-}" ] || MISSING+=("$v")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: missing in .prod.vars: ${MISSING[*]}" >&2
  echo "Note: ALLOWED_ORIGINS must include http://localhost:3000 (the desktop app's origin)." >&2
  exit 1
fi

wrangler deploy \
  --var "YOUTUBE_CLIENT_ID:$YOUTUBE_CLIENT_ID" \
  --var "YOUTUBE_CLIENT_SECRET:$YOUTUBE_CLIENT_SECRET" \
  --var "YOUTUBE_REDIRECT_URI:$YOUTUBE_REDIRECT_URI" \
  --var "COOKIE_ENCRYPTION_KEY:$COOKIE_ENCRYPTION_KEY" \
  --var "ALLOWED_ORIGINS:$ALLOWED_ORIGINS" \
  --var "GITHUB_TOKEN:$GITHUB_TOKEN"

echo "Deployed to: https://churchub-backend.radiocrestin.ro"
