"""Church Hub's bridge to Inworld Voice Isolator (voice-isolator-v1-realtime).

Run by the server with the Python of the venv it set up:
  download --dest DIR   fetch the pinned weights, reporting progress
  bench --weights FILE  stream 3 s of audio and report the real-time factor
  stream --weights FILE 48 kHz mono s16le on stdin -> isolated voice on stdout

Events are JSON lines on stderr, each starting with {"event": ...}; anything
else there is a log line. stdout carries only audio.
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request

LOOKAHEAD_FRAMES = 2
SAMPLE_RATE = 48000
REALTIME = "voice-isolator-v1-realtime"


def emit(event: str, **fields) -> None:
    sys.stderr.write(json.dumps({"event": event, **fields}) + "\n")
    sys.stderr.flush()


def download(dest: str) -> None:
    from inworld.voice_isolation import registry

    entry = registry.MODELS[REALTIME]
    path = os.path.join(dest, entry["filename"])
    if os.path.exists(path) and registry.sha256_file(path) == entry["sha256"]:
        emit("done", path=path)
        return
    os.makedirs(dest, exist_ok=True)
    url = (f"https://huggingface.co/{entry['repo_id']}/resolve/"
           f"{entry['revision']}/{entry['filename']}")
    partial = path + ".part"
    digest = hashlib.sha256()
    with urllib.request.urlopen(url, timeout=60) as response, open(partial,
                                                                   "wb") as out:
        total = int(response.headers.get("Content-Length") or 0)
        received, reported = 0, 0.0
        while block := response.read(1 << 20):
            out.write(block)
            digest.update(block)
            received += len(block)
            if time.monotonic() - reported > 0.5:
                emit("progress", received=received, total=total)
                reported = time.monotonic()
    if digest.hexdigest() != entry["sha256"]:
        os.remove(partial)
        raise RuntimeError(f"Checksum mismatch for {entry['filename']}")
    os.replace(partial, path)
    emit("progress", received=received, total=total)
    emit("done", path=path)


def load(weights: str):
    from inworld import voice_isolation

    isolator = voice_isolation.VoiceIsolator(weights,
                                             mode="streaming",
                                             lookahead_frames=LOOKAHEAD_FRAMES)
    return isolator, str(isolator.device)


def bench(weights: str) -> None:
    import torch

    isolator, device = load(weights)
    session = isolator.stream()
    audio = torch.randn(3 * SAMPLE_RATE) * 0.05
    start = time.monotonic()
    for offset in range(0, len(audio), 1920):
        session.push(audio[offset:offset + 1920])
    session.flush()
    emit("bench", device=device, rtf=(time.monotonic() - start) / 3)


def stream(weights: str) -> None:
    import numpy as np
    import torch

    isolator, device = load(weights)
    session = isolator.stream()
    emit("ready", device=device)
    source, sink = sys.stdin.buffer, sys.stdout.buffer
    leftover = b""
    while chunk := source.read1(65536):
        chunk = leftover + chunk
        usable = len(chunk) - len(chunk) % 2
        leftover = chunk[usable:]
        samples = np.frombuffer(chunk[:usable], dtype="<i2")
        voice = session.push(torch.from_numpy(samples.astype(np.float32) /
                                              32768.0))
        write(sink, voice)
    write(sink, session.flush())


def write(sink, voice) -> None:
    import numpy as np

    if not len(voice):
        return
    samples = np.clip(voice.cpu().numpy() * 32768.0, -32768, 32767)
    sink.write(samples.astype("<i2").tobytes())
    sink.flush()


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("download").add_argument("--dest", required=True)
    for name in ("bench", "stream"):
        commands.add_parser(name).add_argument("--weights", required=True)
    args = parser.parse_args()
    try:
        if args.command == "download":
            download(args.dest)
        elif args.command == "bench":
            bench(args.weights)
        else:
            stream(args.weights)
    except Exception as error:  # reported to the server, which logs it
        emit("error", message=f"{type(error).__name__}: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
