#!/usr/bin/env bash
set -euo pipefail

# Always operate from this script's own directory so it works from any cwd
# (deploy relies on wrangler.toml and .prod.vars sitting next to it).
cd "$(dirname "$0")"

PROD_VARS=".prod.vars"

if [ ! -f "$PROD_VARS" ]; then
  echo "ERROR: $PROD_VARS not found (create it next to deploy.sh)." >&2
  echo "Copy .dev.vars.example and fill in the production values." >&2
  exit 1
fi

# Every `wrangler deploy` REPLACES the worker's vars wholesale. Sourcing an
# empty or incomplete .prod.vars once silently wiped ALLOWED_ORIGINS in
# production and 403'd every OAuth flow. So we parse .prod.vars generically
# and validate every value before shipping.

# Required minimum set: the secret Bindings from src/types.ts, i.e. the
# runtime bindings MINUS the non-sensitive [vars] in wrangler.toml and the
# SIGNALING_KV binding. Adding a new line to .prod.vars is deployed
# automatically; add it here too if it must never be missing.
REQUIRED_VARS=(
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET
  YOUTUBE_REDIRECT_URI
  COOKIE_ENCRYPTION_KEY
  ALLOWED_ORIGINS
  GITHUB_TOKEN
)

# Placeholder markers that indicate an unfilled example value.
PLACEHOLDER_PATTERNS='your-|changeme|change-me|xxxxx|<.*>|placeholder'

declare -a DEPLOY_ARGS=()
declare -A SEEN_VARS=()

# Parse every non-comment, non-empty KEY=VALUE line.
while IFS= read -r rawline || [ -n "$rawline" ]; do
  # Strip a trailing carriage return (Windows-edited .prod.vars).
  line="${rawline%$'\r'}"

  # Skip blank lines and comments (leading whitespace tolerated).
  case "$line" in
    ''|[[:space:]]*'#'*|'#'*) continue ;;
  esac

  # Must look like KEY=VALUE.
  if [[ "$line" != *"="* ]]; then
    continue
  fi

  key="${line%%=*}"
  value="${line#*=}"

  # Trim surrounding whitespace from the key; keep the value verbatim
  # (values may legitimately contain spaces, commas, URLs).
  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"

  # Ignore any accidental non-identifier keys.
  if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    continue
  fi

  # Strip matching surrounding quotes from the value if present.
  if [[ "$value" == \"*\" && ${#value} -ge 2 ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && ${#value} -ge 2 ]]; then
    value="${value:1:${#value}-2}"
  fi

  # Reject empty values outright — a wiped var is exactly the failure mode
  # we are guarding against.
  if [ -z "$value" ]; then
    echo "ERROR: $PROD_VARS has an empty value for '$key'." >&2
    exit 1
  fi

  # Reject leftover placeholder values.
  if echo "$value" | grep -Eiq "$PLACEHOLDER_PATTERNS"; then
    echo "ERROR: $PROD_VARS value for '$key' still looks like a placeholder." >&2
    echo "Replace it with the real production value." >&2
    exit 1
  fi

  SEEN_VARS["$key"]=1
  DEPLOY_ARGS+=(--var "${key}:${value}")
done < "$PROD_VARS"

# Ensure the required minimum set is present.
declare -a MISSING=()
for v in "${REQUIRED_VARS[@]}"; do
  if [ -z "${SEEN_VARS[$v]:-}" ]; then
    MISSING+=("$v")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: $PROD_VARS is missing required vars: ${MISSING[*]}" >&2
  echo "Note: ALLOWED_ORIGINS must include http://localhost:3000 (the desktop app's origin)." >&2
  exit 1
fi

if [ ${#DEPLOY_ARGS[@]} -eq 0 ]; then
  echo "ERROR: no deployable variables parsed from $PROD_VARS." >&2
  exit 1
fi

# Allow overriding the wrangler binary for testing (defaults to `wrangler`).
WRANGLER_CMD="${WRANGLER_CMD:-wrangler}"

echo "Deploying with vars: ${!SEEN_VARS[*]}"
$WRANGLER_CMD deploy "${DEPLOY_ARGS[@]}"

echo "Deployed to: https://churchub-backend.radiocrestin.ro"
