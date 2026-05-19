#!/usr/bin/env python3
"""Insert a new i18n key into en/<ns>.json and ro/<ns>.json.

Usage:
    add-i18n-key.py <namespace> <dot.key.path> <en_value> <ro_value> [--force]

Preserves existing key order. Refuses to overwrite an existing key unless --force.
"""

import argparse
import json
import sys
from pathlib import Path

VALID_NS = {
    "bible", "bibleBooks", "common", "livestream", "music", "presentation",
    "queue", "schedules", "settings", "sidebar", "songKey", "songs",
    "liveTranslation",
}


def find_repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "app" / "apps" / "client" / "src" / "i18n" / "locales").is_dir():
            return parent
    sys.exit("error: could not locate repo root (looking for app/apps/client/src/i18n/locales/)")


def set_nested(obj: dict, dotted: str, value: str, force: bool) -> str | None:
    """Returns None on success, error message string on failure."""
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        if p in cur and not isinstance(cur[p], dict):
            return f"path collision: '{p}' is a string, not an object"
        if p not in cur:
            cur[p] = {}
        cur = cur[p]
    leaf = parts[-1]
    if leaf in cur and not force:
        existing = cur[leaf]
        return f"key already exists with value: {existing!r} (use --force to overwrite)"
    cur[leaf] = value
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("namespace")
    ap.add_argument("key")
    ap.add_argument("en_value")
    ap.add_argument("ro_value")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if args.namespace not in VALID_NS:
        sys.exit(f"error: unknown namespace '{args.namespace}'. Valid: {sorted(VALID_NS)}")

    root = find_repo_root()
    locales_root = root / "app" / "apps" / "client" / "src" / "i18n" / "locales"

    for locale, value in (("en", args.en_value), ("ro", args.ro_value)):
        path = locales_root / locale / f"{args.namespace}.json"
        if not path.is_file():
            sys.exit(f"error: missing locale file: {path}")
        with path.open() as f:
            data = json.load(f)
        err = set_nested(data, args.key, value, args.force)
        if err:
            sys.exit(f"error in {locale}/{args.namespace}.json at '{args.key}': {err}")
        with path.open("w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"  wrote {locale}/{args.namespace}.json :: {args.key} = {value!r}")

    print(f"\nUse in code:  t('{args.namespace}:{args.key}')")
    return 0


if __name__ == "__main__":
    sys.exit(main())
