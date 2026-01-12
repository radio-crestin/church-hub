import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[drop-song-key-column:${level}] ${message}`)
}

const MIGRATION_KEY = 'drop_song_key_column_v1'

/**
 * Drop the redundant 'key' column from songs table (keyLine is kept)
 */
export function dropSongKeyColumn(db: Database): void {
  // Check if migration already applied
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Drop key column migration already applied, skipping')
    return
  }

  // Check if column exists
  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(songs)')
    .all()

  const hasKeyColumn = columns.some((col) => col.name === 'key')

  if (!hasKeyColumn) {
    log('debug', 'Column "key" does not exist, marking migration as complete')
    // Mark migration as complete even if column doesn't exist
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [
        MIGRATION_KEY,
        JSON.stringify({ skipped: true, reason: 'column_not_found' }),
      ],
    )
    return
  }

  log('info', 'Dropping redundant "key" column from songs table...')

  // SQLite doesn't support DROP COLUMN directly in older versions
  // We need to recreate the table without the column

  // CRITICAL: Disable foreign keys to prevent CASCADE DELETE on song_slides
  // when we drop the songs table. song_slides has ON DELETE CASCADE which would
  // wipe all slides if we don't disable this.
  db.run('PRAGMA foreign_keys = OFF')

  db.run('BEGIN TRANSACTION')

  try {
    // Create new table without the key column
    db.run(`
      CREATE TABLE songs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        category_id INTEGER REFERENCES song_categories(id) ON DELETE SET NULL,
        source_filename TEXT,
        author TEXT,
        copyright TEXT,
        ccli TEXT,
        tempo TEXT,
        time_signature TEXT,
        theme TEXT,
        alt_theme TEXT,
        hymn_number TEXT,
        key_line TEXT,
        presentation_order TEXT,
        presentation_count INTEGER NOT NULL DEFAULT 0,
        last_manual_edit INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)

    // Copy data (excluding the key column)
    db.run(`
      INSERT INTO songs_new (
        id, title, category_id, source_filename, author, copyright, ccli,
        tempo, time_signature, theme, alt_theme, hymn_number, key_line,
        presentation_order, presentation_count, last_manual_edit, created_at, updated_at
      )
      SELECT
        id, title, category_id, source_filename, author, copyright, ccli,
        tempo, time_signature, theme, alt_theme, hymn_number, key_line,
        presentation_order, presentation_count, last_manual_edit, created_at, updated_at
      FROM songs
    `)

    // Drop old table
    db.run('DROP TABLE songs')

    // Rename new table
    db.run('ALTER TABLE songs_new RENAME TO songs')

    // Recreate indexes
    db.run('CREATE INDEX idx_songs_title ON songs(title)')
    db.run('CREATE INDEX idx_songs_category_id ON songs(category_id)')

    db.run('COMMIT')

    // Re-enable foreign keys
    db.run('PRAGMA foreign_keys = ON')

    // Verify foreign key integrity
    const fkViolations = db
      .query<{ violations: number }, []>(
        'SELECT COUNT(*) as violations FROM pragma_foreign_key_check',
      )
      .get()?.violations
    if (fkViolations && fkViolations > 0) {
      log('warning', `Foreign key violations found: ${fkViolations}`)
    }

    // Mark migration as complete
    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [MIGRATION_KEY, JSON.stringify({ success: true })],
    )

    log('info', 'Successfully dropped "key" column from songs table')
  } catch (error) {
    db.run('ROLLBACK')
    // Re-enable foreign keys even on failure
    db.run('PRAGMA foreign_keys = ON')
    log('error', `Failed to drop key column: ${error}`)
    throw error
  }
}
