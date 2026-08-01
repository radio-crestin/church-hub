import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[allow-duplicate-bookmarks:${level}] ${message}`)
}

const MIGRATION_KEY = 'allow_duplicate_song_bookmarks_v1'

/**
 * Lets the same song be bookmarked more than once.
 *
 * `song_bookmarks.song_id` carried a UNIQUE index, which made a bookmark
 * identifiable by its song. An operator building a service often wants the same
 * song listed twice — an opening reprise, a repeated chorus — so the index
 * becomes a plain one and every bookmark operation keys on the row `id`
 * instead.
 *
 * Idempotent — safe to run on every boot.
 */
export function allowDuplicateBookmarks(db: Database): void {
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Migration already applied, skipping')
    return
  }

  const index = db
    .query<{ name: string; unique: number }, []>(
      "SELECT name, `unique` FROM pragma_index_list('song_bookmarks') WHERE name = 'idx_song_bookmarks_song_id'",
    )
    .get()

  if (index?.unique) {
    log('info', 'Replacing the UNIQUE song_id index with a plain one...')
    db.run('DROP INDEX IF EXISTS idx_song_bookmarks_song_id')
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_song_bookmarks_song_id ON song_bookmarks (song_id)',
    )
  } else if (!index) {
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_song_bookmarks_song_id ON song_bookmarks (song_id)',
    )
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
