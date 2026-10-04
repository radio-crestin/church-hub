---
id: T-051
title: better-tasks writes valid YAML front matter for every task
sprint: 2026-09-28
urgent: true
status: doing
owner: better-tasks-yaml
rolled: 0
order: -1
created: 2026-10-04
---
## Goal
User: "update also /Users/iosif/Documents/Projects/better-tasks to make sure to generate the tasks perfectly". Cause: the plugin writes front-matter values unquoted, so a title with ": " (also #, leading quotes/brackets/*, &, !, |, >, %, @, `) breaks the YAML on GitHub ("mapping values are not allowed in this context"); 19 church-hub task files hit it (fixed in church-hub 6af34cbc by renaming). Fix: serialize every front-matter value safely (quote/escape when needed, or a real YAML serializer), parse it back identically (round-trip), and keep reading existing unquoted files. Tests cover titles with colons, quotes, #, unicode, emoji, multi-line input. Commit on the current branch; no push.

## Notes
- 2026-10-04: fixed in better-tasks 03918bf (hooks/yaml.ts: quote + escape values YAML would misread; reader unquotes; titles/owners one line) and 902ce44 (bun scripts/yaml-check.ts: Psych + Bun.YAML check). 174/174 plugin tests pass, tsc clean; 51/51 church-hub task files parse as is and rewritten, 0 would change. Not pushed; installed plugin is a GitHub marketplace copy, so it needs push + plugin update + new session.
