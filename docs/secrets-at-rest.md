# Secrets at rest

How the desktop server keeps saved passwords, API keys and tokens encrypted in its database, and what that means for backups, restores and downgrades.
Open this before you store a new secret, change backup or restore code, or help someone whose sign-ins vanished after a restore.

## The rule

Every secret goes through `app/apps/server/src/service/secret-store`. A feature's store seals a value with `sealSecret(value, place)` before it writes the value, and opens it with `openSecret(stored, place)` when it reads it.

To add a secret:

- If it lives in its own column, list the column in `stored-secrets/secretColumns.ts` and its place in `secretPlaces.ts`.
- If it is a field of an `app_settings` JSON value, list it in `secretSettingFields.ts`.
- If a user can change where it is sent (a host, an endpoint, a provider), declare those destination fields next to it (`destination` in `secretPlaces.ts` or `secretSettingFields.ts`). The feature's save keeps a stored secret only while they are unchanged (`requireSameDestination`, below).

The start-up check (below) then seals any plain copy, and logs one it finds unsealed afterwards as an error.

## The data key

One random 256-bit key per data folder seals everything. It never enters the database, so no backup of the database carries it.

| Where | Key kept in |
|---|---|
| macOS | Keychain: service "Church Hub", account `data-key-<id>` |
| Windows | Credential Manager, under the same name |
| Linux desktop | Secret Service (GNOME Keyring, KWallet) via libsecret |
| No secret store (headless Linux, a locked-down PC) | `secret-key.json` in the data folder, mode 0600 |

- **How the server reaches the store.** The server talks to the OS store through `Bun.secrets`, which is built into the Bun runtime. The compiled sidecar therefore needs no native module, and `bun run smoke:sidecar` checks that it works.
- **The key file.** `secret-key.json` names the key's id and where the key lives (`"store": "os"`). Only when there is no store does it hold the key itself.
- **Choosing the store.** `CHURCH_HUB_SECRET_STORE=file` keeps the key in the file; the e2e suite always does. `CHURCH_HUB_SECRET_STORE=os` insists on the OS store.
- **What the user sees.** The Backup settings page and `GET /api/secret-store` say where the key is kept.
- **macOS access.** The macOS item allows any app of this user to read it without a prompt (`allowUnrestrictedAccess`). The app is not code-signed: an item tied to one binary would ask for the user's password after every update, and a church PC can't stop for that at start. The key still stays out of the data folder, out of Time Machine copies of it, and out of every backup.
- **A locked store.** If the store holds the key but can't be reached at start (a locked Linux keyring, a 20 s timeout), the server starts "locked":
  - sealed secrets read as missing;
  - saving one fails;
  - nothing is overwritten;
  - the next start, or a restore, tries again.

  The settings page tells the user to unlock the keyring and restart.
- **A missing key.** If the store answers that the key is gone (it was deleted), a new key is made. Values sealed with the old one are then forgotten, as after a restore from another computer.

## The format

`enc:v1:<key id>:<nonce>:<ciphertext + tag>`, with the last two in base64url.

- v1 is AES-256-GCM, with a random 12-byte nonce for every value and a 16-byte tag.
- The associated data is `church-hub:v1:<table>.<column>[:<row>]`, for example `server_secrets.value:live_translation_host_key` or `app_settings.value:songs_ai_search_config.apiKey`.
- A value copied to another row or field therefore fails its tag.
- An empty string stays empty: it means "not set".

## What is sealed

| Place | What |
|---|---|
| `server_secrets.value` | Signaling host keys (listener link, remote access), the cloud backup sign-in (#287) |
| `youtube_auth.access_token`, `.refresh_token` | YouTube sign-in |
| `google_drive_auth.access_token`, `.refresh_token` | Google Drive backup sign-in |
| `cloud_sync.server_token`, `.read_url` | Cloud sync: the server's token, and the read path whose secret opens the library |
| `obs_config.password` | OBS WebSocket password (the OBS page still shows it, to type into OBS) |
| `song_source_storage.secret_access_key` | S3 secret key for published song sources |
| `users.token` | Each user's token (shown as a QR code; sign-in itself checks `token_hash`) |
| `app_sessions.session_token` | The system API token |
| `app_settings` `songs_ai_search_config`, `bible_ai_search_config`, `ai_search_config` → `apiKey` | AI search keys |
| `app_settings` `live_translation_settings` → `geminiApiKey`, `openaiApiKey` | Live translation keys |

Some secrets are not sealed because they are already safe:

- Password hashes (Argon2id) and token hashes (SHA-256) are already one-way.
- The owner's sign-in ticket for cloud sync stays in memory only.

The settings API returns the AI and live-translation keys as `••••••••`. A form that sends the mask back keeps the saved key, and an empty value clears it. The denylist of server-secret keys (`isServerSecretKey`) stays as a second net.

**A saved secret is kept only for the address it was saved for.** A save that would keep a stored secret is refused with "re-enter the key for the new address" (400) if it also changes where that secret is sent. Otherwise anyone allowed to edit the setting could point it at their own server and receive the church's key without ever seeing it.

| Secret | Kept by | Destination fields |
|---|---|---|
| AI search `apiKey` | sending the mask | `provider`, `baseUrl` |
| S3 secret key | leaving it blank | `endpoint` |
| OBS password | leaving it out | `host`, `port` |
| Live translation keys | sending the mask | none: each key only goes to its own provider |

The AI and S3 forms ask for the key again as soon as the address changes.

**Nothing secret leaves the computer.** `isSecretSettingKey(key)` (service/settings) is true for a server-secret key or any row in `secretSettingFields.ts`. Anything that copies settings elsewhere, such as cloud sync's allow-list, refuses those rows whole. `e2e/cloud-sync.api.spec.ts` checks that no secret value, secret row, server secret or sealed value ever reaches the sync service.

## The start-up check

`initializeDatabase` runs the check after the migrations, on every start and after every restore (`importDatabase`, and the configurations part of a selective import). It runs as one transaction, so an interrupted run is simply done again on the next start.

- **Plain text** (stored by an older version) is sealed. The file is then rewritten (`VACUUM` and a WAL checkpoint), so no plain copy stays in freed pages or the WAL.
- **Sealed with another data folder's key on this computer** (a backup from the installed app restored into a review build, say): the key is found in the OS store by its id, and the value is sealed again with this folder's key.
- **Sealed on another computer** (its key is nowhere here): the value is forgotten, so its feature is set up again (next section).
- **Key store unreachable:** the value is kept as it is, for a later start.

It also seals the copies the app keeps next to `app.db`: `app-v<version>.db` from each upgrade, and `app.db.backup` from the last import.

## Backups and restores

A backup is a copy of `app.db`, so it holds only sealed values. That applies to local backups, Google Drive backups, Church Hub Cloud backups (#287, which also encrypt the whole file under the account key) and exports. Cloud sync uploads songs, schedules and the user list without tokens, never secrets.

- **Same computer:** a restore opens everything, because the key is still in the OS store or the key file.
- **Another computer:** the secrets can't be opened, and each one is reset so its feature asks to be set up again:

  | Feature | What the user does |
  |---|---|
  | YouTube | Sign in again |
  | Google Drive backups | Sign in again (a Drive restore keeps the sign-in it was made with) |
  | Church Hub Cloud backup | Sign in again (a cloud restore keeps the sign-in it was made with) |
  | Cloud sync | The church's owner recovers the church on this computer. A guest church is connected anew. |
  | Live translation | Re-enter the API keys. The listener link changes, and the dashboard says so once. |
  | Remote access | Phones scan the pairing code again |
  | AI search | Re-enter the API key |
  | OBS | Re-enter the password |
  | Song sources | Re-enter the S3 secret key |
  | Users | Each user gets a new token: phones sign in again |

  The Backup page, and the Developer page where a database is imported, list what was reset until the user dismisses it. Each row links to the page where that feature is set up again (`GET /api/secret-store`, `DELETE /api/secret-store/reset-features`). A restore reloads the window on the page it ran from, so the list shows right away.

Secrets stay on the computer that saved them, by decision: there is no passphrase export for moving them. Setting the features up again takes a few minutes, while a portable secrets file would be one more thing to leak.

## Downgrades

An older version can't read sealed values: it sees `enc:v1:…` strings. After a downgrade, sign in again and re-enter the keys as on another computer. The version copies (`app-v<version>.db`) are sealed too, so restoring one of them into an older version is the same.
