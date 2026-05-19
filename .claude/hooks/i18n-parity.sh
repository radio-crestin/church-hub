#!/usr/bin/env bash
# PostToolUse hook — warns when an i18n locale file was edited without
# the matching en/ or ro/ counterpart having the same keys.
# CLAUDE.md mandates en + ro parity for every namespace.
#
# Exit codes:
#   0 — nothing to flag (or warning printed; doesn't block)
# Output: structured JSON on stderr understood by Claude Code as a soft warning.

set -u

payload="$(cat)"
file_path="$(printf '%s' "$payload" | /usr/bin/python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)"

[ -z "$file_path" ] && exit 0

# Only operate on edits inside i18n/locales/<lang>/<ns>.json
case "$file_path" in
  */apps/client/src/i18n/locales/*/*.json) ;;
  *) exit 0 ;;
esac

# Extract locale + namespace from the path
ns_file="${file_path##*/}"            # e.g. songs.json
locale_dir="${file_path%/*}"          # .../locales/en
locale="${locale_dir##*/}"            # en
locales_root="${locale_dir%/*}"       # .../locales

# Find the two primary locales' counterparts
en_file="$locales_root/en/$ns_file"
ro_file="$locales_root/ro/$ns_file"

[ ! -f "$en_file" ] && exit 0
[ ! -f "$ro_file" ] && exit 0

# Compare top-level key sets via python — simple, no jq dep
diff_out="$(/usr/bin/python3 - "$en_file" "$ro_file" <<'PY' 2>/dev/null
import json, sys

def flat_keys(obj, prefix=""):
    out = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            out |= flat_keys(v, f"{prefix}{k}." if not prefix else f"{prefix}{k}.")
            out.add(f"{prefix}{k}")
    return out

with open(sys.argv[1]) as f: en = json.load(f)
with open(sys.argv[2]) as f: ro = json.load(f)

en_keys = flat_keys(en)
ro_keys = flat_keys(ro)
missing_in_ro = sorted(en_keys - ro_keys)
missing_in_en = sorted(ro_keys - en_keys)

if missing_in_ro or missing_in_en:
    if missing_in_ro:
        print("missing in ro: " + ", ".join(missing_in_ro[:8]) + (f" (+{len(missing_in_ro)-8} more)" if len(missing_in_ro)>8 else ""))
    if missing_in_en:
        print("missing in en: " + ", ".join(missing_in_en[:8]) + (f" (+{len(missing_in_en)-8} more)" if len(missing_in_en)>8 else ""))
PY
)"

if [ -n "$diff_out" ]; then
  echo "[i18n-parity] $ns_file out of sync between en/ and ro/:" >&2
  printf '  %s\n' "$diff_out" >&2
fi
exit 0
