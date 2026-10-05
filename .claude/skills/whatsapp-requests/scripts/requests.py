#!/usr/bin/env python3
"""Track the WhatsApp group's reported requests in a private ledger.

Usage (from the church-hub root):
  python3 .claude/skills/whatsapp-requests/scripts/requests.py new
  python3 .claude/skills/whatsapp-requests/scripts/requests.py set <msg_id> <status> <task|-> <evidence|-> <summary>
  python3 .claude/skills/whatsapp-requests/scripts/requests.py ready
  python3 .claude/skills/whatsapp-requests/scripts/requests.py react <msg_id> [<msg_id> ...]
  python3 .claude/skills/whatsapp-requests/scripts/requests.py stats

The WAHA API key is read in-process from the WhatsApp environment's secrets file
and never printed. Senders are shown as P1, P2 ... (per run); no names or numbers.
"""
import datetime
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
PRIVATE = os.path.join(ROOT, ".claude/tasks-private")
CONFIG = os.path.join(PRIVATE, "whatsapp-requests.config.json")
LEDGER = os.path.join(PRIVATE, "whatsapp-requests.tsv")
TASKS = os.path.join(ROOT, ".claude/tasks")
STATUSES = {"new", "task", "implemented", "unsure", "wontfix", "ignored"}
COLUMNS = ["msg_id", "date", "status", "task", "evidence", "summary"]
HEADER = """# WhatsApp group requests ledger: one row per group message. Private (gitignored).
# Query, don't read: grep -i <word> whatsapp-requests.tsv | grep -P '\\ttask\\t' etc.
# Columns (tab-separated): msg_id, date, status (new|task|implemented|unsure|wontfix|ignored), task, evidence, summary.
# Written by .claude/skills/whatsapp-requests/scripts/requests.py; no names, phone numbers or secrets.
"""


def load_config():
    if not os.path.exists(CONFIG):
        sys.exit(f"Missing {CONFIG} (see the skill's SKILL.md, Setup).")
    with open(CONFIG) as f:
        return json.load(f)


def api_key(config):
    import yaml  # PyYAML
    with open(config["secrets_file"]) as f:
        secrets = yaml.safe_load(f)
    return secrets["app_secrets"][config["env_secret"]]["string_data"]["WAHA_API_KEY"]


def call(config, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        config["base_url"] + path, data=data, method=method,
        headers={"X-Api-Key": api_key(config), "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def group_id(config):
    info = call(config, "GET", f"/api/{config['session']}/groups/join-info?code={config['invite_code']}")
    return info["id"]


def fetch_messages(config):
    gid = urllib.parse.quote(group_id(config))
    messages = call(config, "GET", f"/api/{config['session']}/chats/{gid}/messages?limit=5000&downloadMedia=false")
    return sorted(messages, key=lambda m: m.get("timestamp", 0))


def short_id(message):
    """The message's own id, without the group or sender parts."""
    return message["id"].split("_")[2]


def reactions(message):
    return [r.get("text") or "" for r in (message.get("_data") or {}).get("reactions") or []]


def read_ledger():
    rows = {}
    if os.path.exists(LEDGER):
        for line in open(LEDGER, encoding="utf-8"):
            if line.startswith("#") or not line.strip() or line.startswith("msg_id\t"):
                continue
            values = line.rstrip("\n").split("\t")
            rows[values[0]] = dict(zip(COLUMNS, values + [""] * (len(COLUMNS) - len(values))))
    return rows


def write_ledger(rows):
    os.makedirs(PRIVATE, exist_ok=True)
    with open(LEDGER, "w", encoding="utf-8") as f:
        f.write(HEADER)
        f.write("\t".join(COLUMNS) + "\n")
        for row in sorted(rows.values(), key=lambda r: (r["date"], r["msg_id"])):
            f.write("\t".join(clean(row[c]) for c in COLUMNS) + "\n")


def clean(text):
    return re.sub(r"[\t\n\r]+", " ", str(text)).strip()


def task_status(task_id):
    for name in os.listdir(TASKS):
        if name.startswith(task_id + "-"):
            match = re.search(r"^status:\s*(\S+)", open(os.path.join(TASKS, name)).read(), re.M)
            return match.group(1) if match else "?"
    return "missing"


def cmd_new(config):
    ledger = read_ledger()
    aliases = {}
    fresh = [m for m in fetch_messages(config) if short_id(m) not in ledger]
    for m in fresh:
        sender = "me" if m.get("fromMe") else aliases.setdefault(m.get("participant"), f"P{len(aliases) + 1}")
        when = datetime.datetime.fromtimestamp(m.get("timestamp", 0)).strftime("%Y-%m-%d %H:%M")
        reply = (m.get("replyTo") or {}).get("body")
        reply_text = f" (reply to: {clean(reply)[:60]})" if reply else ""
        media = " [media]" if m.get("hasMedia") else ""
        print(f"{short_id(m)} | {when} | {sender} | {''.join(reactions(m))} |{media}{reply_text} {clean(m.get('body') or '')}")
    print(f"-- known: {len(ledger)}, new: {len(fresh)}")


def cmd_set(msg_id, status, task, evidence, summary):
    if status not in STATUSES:
        sys.exit(f"status must be one of {sorted(STATUSES)}")
    rows = read_ledger()
    row = rows.get(msg_id) or {"msg_id": msg_id, "date": datetime.date.today().isoformat()}
    if len(sys.argv) > 7:
        row["date"] = sys.argv[7]
    row.update(status=status, task="" if task == "-" else task,
               evidence="" if evidence == "-" else evidence, summary=summary)
    rows[msg_id] = row
    write_ledger(rows)
    print("saved", msg_id, status)


def cmd_ready():
    """Rows linked to a task that is now done, not yet marked implemented."""
    for row in read_ledger().values():
        if row["status"] == "task" and row["task"]:
            state = task_status(row["task"])
            if state == "done":
                print(f"{row['msg_id']} | {row['task']} done | {row['summary']}")


def cmd_react(config, ids):
    by_id = {short_id(m): m for m in fetch_messages(config)}
    for msg_id in ids:
        message = by_id.get(msg_id)
        if message is None:
            print(msg_id, "not found")
        elif "✅" in reactions(message):
            print(msg_id, "already ✅")
        else:
            call(config, "PUT", "/api/reaction",
                 {"session": config["session"], "messageId": message["id"], "reaction": "✅"})
            print(msg_id, "reacted ✅")


def cmd_stats():
    counts = {}
    for row in read_ledger().values():
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    print(json.dumps(counts, indent=1))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    command, args = sys.argv[1], sys.argv[2:]
    if command == "new":
        cmd_new(load_config())
    elif command == "set" and len(args) >= 5:
        cmd_set(*args[:5])
    elif command == "ready":
        cmd_ready()
    elif command == "react" and args:
        cmd_react(load_config(), args)
    elif command == "stats":
        cmd_stats()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
