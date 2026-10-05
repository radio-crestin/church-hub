---
name: whatsapp-requests
description: Track the requests and bug reports posted in the church-hub WhatsApp group ("Church Hub Bugs") in a private ledger; show the new ones since the last run, create better-tasks tasks for them only when the user says so, and react ✅ on requests whose task is done. Use when the user says "check the WhatsApp requests", "what's new in the WhatsApp group", "create tasks for the new WhatsApp messages", or "mark the fixed WhatsApp requests".
---

# whatsapp-requests

Keeps one row per group message in a private ledger, so each run only looks at what is new.
Open when the user asks about the WhatsApp group's requests.

## Where things are

- Script: `.claude/skills/whatsapp-requests/scripts/requests.py` (run from the church-hub root, `python3`, needs PyYAML).
- Ledger: `.claude/tasks-private/whatsapp-requests.tsv` (gitignored). Query it, don't read it: `grep -i <word>`, `grep -P '\tunsure\t'`, `requests.py stats`.
- Config: `.claude/tasks-private/whatsapp-requests.config.json` (gitignored): WAHA URL, session, group invite code, path of the WhatsApp environment's secrets file.
- WAHA is the WhatsApp HTTP API in `bringes-infrastructure/environments/whatsapp_production` (LAN/VPN only). Not reachable → tell the user to connect to the LAN/VPN; never work around it.

## Secrets (required)

- The script reads the API key in-process; never print, copy or log it, never `cat` the secrets file, never edit bringes-infrastructure.
- Ledger summaries, task texts, notes, commits and PRs carry plain request summaries only: no names, phone numbers or ids of people. The script shows senders as P1, P2… and `me`.
- Only reactions in the group, never messages.

## Statuses

`new` (seen, not decided) · `task` (linked to a task, not done) · `implemented` (done; ✅ in the group) · `unsure` (request, unclear if done or no task found) · `wontfix` (by design) · `ignored` (chat, replies, media).

## Steps

1. **New messages**: `requests.py new` prints the messages not in the ledger, then `known: N, new: M`.
2. **Classify** each new message:
   - Chat, thanks, discussion → `set <id> ignored - - "<short summary>" <date>`.
   - A request or bug → check if a task already covers it: `grep -il "<key words>" .claude/tasks/T-*.md` (the tasks quote the original Romanian). Covered → `set <id> task T-xxx - "<summary>" <date>`. Not covered → `set <id> new - - "<summary>" <date>`.
   - Already done on main (merged PR or commit dated after the message) → `implemented` with the evidence. Use an Explore scout for code checks.
3. **Show the user** the new requests as a short table (summary · status · task) and ask which to turn into tasks. Create tasks **only when the user says so**: `task_create` with the request in plain words and the original Romanian quote, backlog unless the user names a sprint; then `set <id> task T-xxx ...`.
4. **Mark fixed requests** (when asked): `requests.py ready` lists `task` rows whose task is now `done`. Show them to the user; for the ones confirmed, `requests.py react <id> ...` (skips ones that already have ✅), then `set <id> implemented T-xxx "<PR/commit>" "<summary>"`. More than ~15, or unsure ones → ask first.
5. Report: `requests.py stats` and what changed.

`set` arguments: `<msg_id> <status> <task|-> <evidence|-> "<summary>" [<date YYYY-MM-DD>]`.
