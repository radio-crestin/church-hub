---
id: T-081
title: "Skill: track the WhatsApp group's reported requests and create tasks for new ones on demand"
sprint: 2026-10-05
urgent: false
status: done
owner: whatsapp-requests
rolled: 0
order: -3
created: 2026-10-05
---
## Goal
User's words: "also, write a skill to keep track of all the reported messages and create tasks for the new ones when i say"

Builds on T-079 (same WhatsApp group, read through bringes-infrastructure/environments/whatsapp_production).

What the skill does, when the user invokes it ("check the WhatsApp requests" or similar):
- Reads the group's messages since the last run.
- Keeps a ledger of every reported message: short summary, date, message id, linked task id, status (new / task created / implemented ✅ / ignored).
- Shows the user the NEW requests (not yet in the ledger) and creates better-tasks tasks for them only when the user says so (task_create with the request in plain words; backlog unless the user names otherwise).
- Can also re-run the T-079 check: react ✅ on requests whose task is done.

Defaults (lead's choice, change if the user says otherwise):
- Skill in church-hub `.claude/skills/<name>/SKILL.md` (committed).
- The ledger holds people's messages, so it is private: gitignored, e.g. `.claude/tasks-private/` (same place as security notes). No names, phone numbers or secrets in it or in the skill; secrets rules of T-079 apply.
- Seed the ledger with what T-079 found.

Done = skill committed, ledger seeded, a dry run shown in the notes (how many known, how many new).

## Notes
- 2026-10-05: 2026-10-05 done (commit 46573d4b on main, not pushed).
- Skill: .claude/skills/whatsapp-requests/SKILL.md + scripts/requests.py. Commands: new (messages not in the ledger, senders as P1/P2/me), set (classify a row), ready (task rows whose task is now done), react (✅, skips ones that already have it), stats. The API key is read in-process from the WhatsApp env's secrets file and never printed. Tasks are created only when the user says so.
- Private, gitignored: .claude/tasks-private/whatsapp-requests.tsv (the ledger, one row per message, grep it) and whatsapp-requests.config.json (WAHA URL, session, invite code, secrets path). No names or phone numbers in either.
- Seeded from T-079: all 197 messages = implemented 84, task 38, unsure 13, wontfix 1, ignored 61. 28 messages linked to tasks automatically by their Romanian quotes, the rest by hand.
- Dry run: `requests.py new` → known 197, new 0. `requests.py ready` → 3 candidates for ✅, not reacted: P2's "make it optional" reply (T-041), the stuck verse scroll (T-014, closed as already fixed), and "a song was projected" (T-030).
- Unsure, with no task found (could become tasks): add-song modal too small; minimal program view next to marcaje (❤️); load program songs into marcaje; manage programs in the sidebar.
- Test: `python3 .claude/skills/whatsapp-requests/scripts/requests.py new` from the church-hub root, on LAN/VPN.
- Not verified: invoking the skill by its trigger phrase in a fresh session.
- 2026-10-05: User resolved T-081. Follow-ups approved by the user: react ✅ on the 3 "ready" rows (T-041, T-014, T-030); the 4 unsure requests became backlog tasks: add-song window too small → T-085, minimal program view next to marcaje → T-086, load program songs into marcaje → T-087, manage programs from the sidebar → T-088. Link them in the ledger.
- 2026-10-05: whatsapp-requests skill + private ledger of all 197 group messages; shows new ones, creates tasks on request, reacts ✅ when a task is done. Follow-ups: 3 ✅, T-085..T-088.
