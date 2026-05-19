#!/usr/bin/env bash
# Record a screen-capture mp4 for one feature using ffmpeg.
# Cross-platform: avfoundation (macOS), x11grab (Linux), gdigrab (Windows/Git Bash).
#
# Usage:
#   record-feature.sh start <sha-or-name>   # starts background ffmpeg, prints PID + output path
#   record-feature.sh stop  <pid>           # gracefully stops ffmpeg via SIGINT (writes mp4 trailer)
#
# Output: /tmp/pr-demos/<sha-or-name>.mp4

set -u

out_dir="/tmp/pr-demos"
mkdir -p "$out_dir"

cmd="${1:-}"
arg="${2:-}"

if [ -z "$cmd" ]; then
  echo "usage: $0 {start <name> | stop <pid>}" >&2
  exit 1
fi

case "$cmd" in
  start)
    [ -z "$arg" ] && { echo "error: 'start' requires a name (commit sha)" >&2; exit 1; }
    out="$out_dir/$arg.mp4"
    log="$out_dir/$arg.log"

    case "$(uname -s)" in
      Darwin)
        # avfoundation: '2:none' = "Capture screen 0", no audio.
        # To pick a different screen, set SCREEN_INDEX (default 2).
        screen="${SCREEN_INDEX:-2}"
        ffmpeg -y -nostdin -f avfoundation -framerate 30 -capture_cursor 1 \
          -i "${screen}:none" -vcodec libx264 -preset ultrafast -pix_fmt yuv420p \
          "$out" >"$log" 2>&1 &
        ;;
      Linux)
        display="${DISPLAY:-:0}"
        size="${SCREEN_SIZE:-1920x1080}"
        ffmpeg -y -nostdin -f x11grab -framerate 30 -video_size "$size" \
          -i "$display" -vcodec libx264 -preset ultrafast -pix_fmt yuv420p \
          "$out" >"$log" 2>&1 &
        ;;
      MINGW*|MSYS*|CYGWIN*)
        ffmpeg -y -nostdin -f gdigrab -framerate 30 -i desktop \
          -vcodec libx264 -preset ultrafast -pix_fmt yuv420p \
          "$out" >"$log" 2>&1 &
        ;;
      *) echo "error: unsupported OS $(uname -s)" >&2; exit 1 ;;
    esac

    pid=$!
    sleep 0.5
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "error: ffmpeg exited immediately; see $log" >&2
      cat "$log" >&2
      exit 1
    fi
    echo "recording: pid=$pid out=$out log=$log"
    echo "stop with: $0 stop $pid"
    ;;

  stop)
    [ -z "$arg" ] && { echo "error: 'stop' requires a PID" >&2; exit 1; }
    if ! kill -0 "$arg" 2>/dev/null; then
      echo "error: pid $arg not running" >&2
      exit 1
    fi
    # SIGINT lets ffmpeg write the moov atom; SIGTERM would corrupt the mp4
    kill -INT "$arg"
    # Wait up to 5s for it to finish flushing
    for _ in $(seq 1 10); do
      if ! kill -0 "$arg" 2>/dev/null; then break; fi
      sleep 0.5
    done
    if kill -0 "$arg" 2>/dev/null; then
      kill -9 "$arg" 2>/dev/null
      echo "warning: ffmpeg did not exit cleanly; mp4 may be unplayable" >&2
    fi
    echo "stopped: pid=$arg"
    ;;

  *)
    echo "usage: $0 {start <name> | stop <pid>}" >&2
    exit 1
    ;;
esac
