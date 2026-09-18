import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-song-background:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_song_background_v1'

/**
 * Adds the `background` column to `songs` — a JSON `ScreenBackgroundConfig`
 * that replaces the screen's background while the song is shown. NULL means
 * the screen's own background applies. Idempotent.
 */
export function addSongBackground(db: Database): void {
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
    .query<{ name: string }, []>('PRAGMA table_info(songs)')
    .all()
  const hasColumn = columns.some((col) => col.name === 'background')

  if (!hasColumn) {
    log('info', 'Adding "background" column to songs table...')
    db.run('ALTER TABLE songs ADD COLUMN background TEXT')
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
