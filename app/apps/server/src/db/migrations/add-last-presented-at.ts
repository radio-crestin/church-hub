import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-last-presented-at:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_last_presented_at_v1'

/**
 * Add last_presented_at column to songs table for sorting by latest presented time
 */
export function addLastPresentedAt(db: Database): void {
  // Check if migration already applied
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Add last_presented_at migration already applied, skipping')
    return
  }

  // Check if column already exists
  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(songs)')
    .all()

  const hasColumn = columns.some((col) => col.name === 'last_presented_at')

  if (hasColumn) {
    log(
      'debug',
      'Column "last_presented_at" already exists, marking migration as complete',
    )
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [
        MIGRATION_KEY,
        JSON.stringify({ skipped: true, reason: 'column_already_exists' }),
      ],
    )
    return
  }

  log('info', 'Adding "last_presented_at" column to songs table...')

  try {
    // Add the column (SQLite supports ALTER TABLE ADD COLUMN)
    db.run('ALTER TABLE songs ADD COLUMN last_presented_at INTEGER')

    // Create index for sorting by last presented
    db.run(
      'CREATE INDEX idx_songs_last_presented_at ON songs(last_presented_at)',
    )

    // Mark migration as complete
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [MIGRATION_KEY, JSON.stringify({ success: true })],
    )

    log('info', 'Successfully added "last_presented_at" column to songs table')
  } catch (error) {
    log('error', `Failed to add last_presented_at column: ${error}`)
    throw error
  }
}
