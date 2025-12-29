#!/usr/bin/env bash
set -e

source .prod.vars

wrangler deploy \
  --var "YOUTUBE_CLIENT_ID:$YOUTUBE_CLIENT_ID" \
  --var "YOUTUBE_CLIENT_SECRET:$YOUTUBE_CLIENT_SECRET" \
  --var "YOUTUBE_REDIRECT_URI:$YOUTUBE_REDIRECT_URI" \
  --var "COOKIE_ENCRYPTION_KEY:$COOKIE_ENCRYPTION_KEY" \
  --var "ALLOWED_ORIGINS:$ALLOWED_ORIGINS" \
  --var "GITHUB_TOKEN:$GITHUB_TOKEN"

echo "Deployed to: https://churchub-backend.radiocrestin.ro"
