---
name: add-i18n-string
description: Add a new i18n key with English + Romanian translations to a chosen namespace. Use whenever you introduce a new user-facing string in the React client. CLAUDE.md mandates en + ro for every namespace; this skill enforces parity in one step.
disable-model-invocation: true
---

# add-i18n-string

You are adding a new translation key to the project's i18n locale files.

## Steps

1. **Gather inputs** — if not provided, ask the user for:
   - **namespace** (a file in `app/apps/client/src/i18n/locales/en/`)
   - **key path** in dot notation (e.g. `actions.archive`, `editor.subtitlePlaceholder`)
   - **English value**
   - **Romanian value**

2. **Run the helper**:
   ```bash
   .claude/skills/add-i18n-string/scripts/add-i18n-key.py <namespace> <key.path> <en_value> <ro_value>
   ```
   The script writes to both `app/apps/client/src/i18n/locales/en/<ns>.json` and `.../ro/<ns>.json`, preserves existing key order, and refuses to overwrite an existing key (unless `--force`).

3. **Report the diff** — show the two-file change so the user can confirm.

4. **Suggest the call site** — print the exact `t('<namespace>:<key.path>')` snippet the React code should use.

## Constraints

- Only `en/` and `ro/` are statically imported in `app/apps/client/src/i18n/config.ts`; the other locale dirs are dormant, so leave them alone.
- Leave `app/apps/client/src/i18n/config.ts` alone: namespaces are already registered.
- If the namespace doesn't exist yet, stop and tell the user; adding a namespace requires editing the config and is out of scope for this skill.
