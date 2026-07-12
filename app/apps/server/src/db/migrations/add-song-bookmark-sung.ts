import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-song-bookmark-sung:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_song_bookmark_sung_v1'

/**
 * Adds the manual "already sung" marker to `song_bookmarks`:
 * - `is_sung`: 0/1 flag the operator toggles from the bookmarks list.
 * - `sung_at`: when it was marked (null when not sung).
 * Idempotent — safe to run on every boot.
 */
export function addSongBookmarkSung(db: Database): void {
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Migration already applied, skipping')
    return
  }

  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(song_bookmarks)')
    .all()
  const hasIsSung = columns.some((col) => col.name === 'is_sung')
  const hasSungAt = columns.some((col) => col.name === 'sung_at')

  if (!hasIsSung) {
    log('info', 'Adding "is_sung" column to song_bookmarks table...')
    db.run(
      'ALTER TABLE song_bookmarks ADD COLUMN is_sung INTEGER NOT NULL DEFAULT 0',
    )
  }
  if (!hasSungAt) {
    log('info', 'Adding "sung_at" column to song_bookmarks table...')
    db.run('ALTER TABLE song_bookmarks ADD COLUMN sung_at INTEGER')
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
