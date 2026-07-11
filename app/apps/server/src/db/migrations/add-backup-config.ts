import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-backup-config:${level}] ${message}`)
}

/**
 * Adds the `backup_config` table used by the Google Drive backup feature.
 * Holds the automatic-backup preferences and the last successful upload time.
 * Auth tokens are not stored here — backups reuse the `youtube_auth` connection.
 *
 * Idempotent — safe to run on every boot.
 */
export function addBackupConfig(db: Database): void {
  const tableExists = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'backup_config'",
    )
    .get()

  if (!tableExists) {
    log('info', 'Creating "backup_config" table...')
    db.run(`
      CREATE TABLE backup_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auto_backup_enabled INTEGER NOT NULL DEFAULT 0,
        interval_hours INTEGER NOT NULL DEFAULT 24,
        last_backup_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  }
}
