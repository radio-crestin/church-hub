import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-backup-config:${level}] ${message}`)
}

/** Adds a `backup_config` column when it isn't there yet. */
function addColumnIfMissing(
  db: Database,
  column: string,
  definition: string,
): void {
  const exists = db
    .query<{ name: string }, [string]>(
      "SELECT name FROM pragma_table_info('backup_config') WHERE name = ?",
    )
    .get(column)

  if (!exists) {
    log('info', `Adding "${column}" column to "backup_config"...`)
    db.run(`ALTER TABLE backup_config ADD COLUMN ${column} ${definition}`)
  }
}

/**
 * Adds the tables used by the Google Drive backup feature:
 * - `backup_config`: automatic-backup preferences + last upload time.
 * - `google_drive_auth`: the independent Google connection for backups
 *   (its own OAuth client, separate from the livestream YouTube connection).
 *
 * Idempotent — safe to run on every boot.
 */
export function addBackupConfig(db: Database): void {
  const configExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'backup_config'",
    )
    .get()

  if (!configExists) {
    log('info', 'Creating "backup_config" table...')
    db.run(`
      CREATE TABLE backup_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auto_backup_enabled INTEGER NOT NULL DEFAULT 0,
        interval_hours INTEGER NOT NULL DEFAULT 24,
        max_backups INTEGER NOT NULL DEFAULT 5,
        last_backup_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  } else {
    const hasMaxBackups = db
      .query<{ name: string }, []>(
        "SELECT name FROM pragma_table_info('backup_config') WHERE name = 'max_backups'",
      )
      .get()

    if (!hasMaxBackups) {
      log('info', 'Adding "max_backups" column to "backup_config"...')
      db.run(
        'ALTER TABLE backup_config ADD COLUMN max_backups INTEGER NOT NULL DEFAULT 5',
      )
    }
  }

  // Local backups: a chosen folder each backup is also written to, plus the
  // timestamp of the last successful local write. Added separately from the
  // CREATE above so existing installs pick them up too.
  addColumnIfMissing(db, 'local_backup_path', 'TEXT')
  addColumnIfMissing(db, 'last_local_backup_at', 'INTEGER')

  const authExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'google_drive_auth'",
    )
    .get()

  if (!authExists) {
    log('info', 'Creating "google_drive_auth" table...')
    db.run(`
      CREATE TABLE google_drive_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        email TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  }
}
