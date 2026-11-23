#!/usr/bin/env bash
# Local security checks before a release (release.sh runs this before the
# version bump; run it by hand any time):
#
#   1. gitleaks over every commit since the last release tag (.gitleaks.toml).
#   2. CodeQL, the same languages and query suite as .github/workflows/codeql.yml
#      (javascript-typescript, actions, rust; build-mode none; the default
#      code-scanning suite, the CLI's default as in CI; the same paths-ignore).
#
# Fails on any gitleaks finding and on any error- or warning-level CodeQL
# alert (or one rated high/critical security severity). Works on macOS, Linux
# and Windows (Git Bash). Needs gitleaks, bun and the CodeQL bundle (the CLI
# with its query packs, offline) on PATH, or CODEQL=<path to its codeql>.
#
# Usage: ./scripts/security-check.sh [gitleaks|codeql]   (default: both)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ONLY="${1:-all}"
LANGUAGES=(javascript-typescript actions rust)

os_name() {
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo macos ;;
    Linux) echo linux ;;
    MINGW* | MSYS* | CYGWIN*) echo windows ;;
    *) echo other ;;
  esac
}

# codeql.exe on Windows takes Windows paths, not Git Bash's /c/... ones.
native_path() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else echo "$1"; fi
}

install_hint() {
  echo "error: $1 is not installed: the release's security check needs it." >&2
  case "$1:$(os_name)" in
    gitleaks:macos) echo "Install it:  brew install gitleaks" >&2 ;;
    gitleaks:linux) echo "Install it:  sudo apt install gitleaks   (or a release binary: https://github.com/gitleaks/gitleaks/releases)" >&2 ;;
    gitleaks:windows) echo "Install it:  winget install Gitleaks.Gitleaks   (or: scoop install gitleaks)" >&2 ;;
    codeql:*)
      local bundle
      case "$(os_name)" in macos) bundle=osx64 ;; windows) bundle=win64 ;; *) bundle=linux64 ;; esac
      {
        echo "Install the CodeQL bundle (the CLI and its query packs), then put its folder on PATH:"
        echo "  curl -fsSLO https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-$bundle.tar.gz"
        echo "  tar -xzf codeql-bundle-$bundle.tar.gz   # makes ./codeql/codeql"
        echo "(or set CODEQL=/path/to/codeql/codeql)"
      } >&2
      ;;
    *) echo "Install it and put it on PATH." >&2 ;;
  esac
  exit 1
}

run_gitleaks() {
  command -v gitleaks >/dev/null 2>&1 || install_hint gitleaks
  local last_tag range
  last_tag=$(git -C "$REPO_ROOT" describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)
  range="${last_tag:+$last_tag..}HEAD"
  echo "== gitleaks: commits $range"
  if ! gitleaks git --redact --no-banner --config "$REPO_ROOT/.gitleaks.toml" \
    --log-opts="$range" "$REPO_ROOT"; then
    echo "error: gitleaks found a secret in $range: remove it from history before releasing." >&2
    return 1
  fi
}

run_codeql() {
  local codeql="${CODEQL:-codeql}"
  command -v "$codeql" >/dev/null 2>&1 || install_hint codeql
  command -v bun >/dev/null 2>&1 || install_hint bun

  local work
  work=$(mktemp -d)
  # shellcheck disable=SC2064 # expand now: $work is local
  trap "rm -rf '$work'" RETURN
  cat >"$work/config.yml" <<'EOF'
paths-ignore:
  - '**/node_modules/**'
  - '**/dist/**'
  - '**/target/**'
  - 'app/apps/server/src/db/migrations/embedded.ts'
EOF

  # The Rust extractor runs `cargo check` on the Tauri shell: a fresh target
  # dir costs over an hour; this one (gitignored, `cargo clean` empties it)
  # makes the next run take minutes.
  export CODEQL_EXTRACTOR_RUST_OPTION_CARGO_TARGET_DIR="${CODEQL_EXTRACTOR_RUST_OPTION_CARGO_TARGET_DIR:-$(native_path "$REPO_ROOT/app/tauri/target/codeql")}"

  local lang sarifs=()
  for lang in "${LANGUAGES[@]}"; do
    echo "== CodeQL: $lang"
    SECONDS=0
    "$codeql" database create "$(native_path "$work/db-$lang")" \
      --language="$lang" --build-mode=none --overwrite --threads=0 \
      --source-root="$(native_path "$REPO_ROOT")" \
      --codescanning-config="$(native_path "$work/config.yml")" >"$work/create-$lang.log" 2>&1 \
      || { cat "$work/create-$lang.log" >&2; echo "error: CodeQL could not build the $lang database" >&2; return 1; }
    echo "   database: ${SECONDS}s"
    SECONDS=0
    "$codeql" database analyze "$(native_path "$work/db-$lang")" \
      --threads=0 --format=sarif-latest \
      --output="$(native_path "$work/$lang.sarif")" >"$work/analyze-$lang.log" 2>&1 \
      || { cat "$work/analyze-$lang.log" >&2; echo "error: CodeQL could not analyse $lang" >&2; return 1; }
    echo "   analysis: ${SECONDS}s"
    sarifs+=("$work/$lang.sarif")
  done
  bun "$SCRIPT_DIR/codeql-serious-alerts.ts" "${sarifs[@]}"
}

case "$ONLY" in
  gitleaks) run_gitleaks ;;
  codeql) run_codeql ;;
  all) run_gitleaks && run_codeql ;;
  *) echo "usage: $0 [gitleaks|codeql]" >&2; exit 1 ;;
esac
echo "Security check passed."
