#!/usr/bin/env bash
# Smoke-test the bundled sidecar — launch it, wait for /ping 200, fail on early exit.
# Cross-platform: works on macOS, Linux, Windows (Git Bash / WSL).
#
# Exit codes:
#   0 — /ping returned 200
#   1 — process exited before responding (v0.1.60-class bug)
#   2 — process alive but /ping never became ready

set -u

bin="${1:-}"
port="${2:-3000}"
timeout="${SMOKE_TIMEOUT:-20}"

# Auto-detect binary path if not provided
if [ -z "$bin" ]; then
  case "$(uname -s)" in
    Darwin|Linux) bin="app/apps/server/dist/server" ;;
    MINGW*|MSYS*|CYGWIN*) bin="app/apps/server/dist/server.exe" ;;
    *) echo "error: unknown OS $(uname -s)" >&2; exit 1 ;;
  esac
fi

if [ ! -x "$bin" ]; then
  echo "error: binary not found or not executable: $bin" >&2
  echo "       run 'bun run build:apps' first" >&2
  exit 1
fi

log="/tmp/release-smoke-$$.log"
echo "smoke: launching $bin on port $port (timeout ${timeout}s, log: $log)"

# Launch in background, redirect both streams to log
PORT="$port" "$bin" >"$log" 2>&1 &
pid=$!

cleanup() {
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    sleep 0.5
    kill -9 "$pid" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

deadline=$(( $(date +%s) + timeout ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "smoke: process exited before /ping responded — this is the v0.1.60 failure mode" >&2
    echo "---- captured output ----" >&2
    cat "$log" >&2
    exit 1
  fi
  if curl -fsS -o /dev/null -m 1 "http://127.0.0.1:${port}/ping" 2>/dev/null; then
    echo "smoke: /ping returned 200 — sidecar is alive"
    exit 0
  fi
  sleep 0.5
done

echo "smoke: timeout — process alive but /ping never returned 200" >&2
echo "---- captured output ----" >&2
cat "$log" >&2
exit 2
