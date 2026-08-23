import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-song-slide-style-overrides:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_song_slide_style_overrides_v1'

/**
 * Adds the `style_overrides` column to `song_slides` — a JSON blob describing
 * how one slide departs from the screen's default text style (font scale,
 * alignment, bold/italic/underline, per-selection ranges). NULL means the slide
 * follows the screen settings. Idempotent.
 */
export function addSongSlideStyleOverrides(db: Database): void {
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
    .query<{ name: string }, []>('PRAGMA table_info(song_slides)')
    .all()
  const hasColumn = columns.some((col) => col.name === 'style_overrides')

  if (!hasColumn) {
    log('info', 'Adding "style_overrides" column to song_slides table...')
    db.run('ALTER TABLE song_slides ADD COLUMN style_overrides TEXT')
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
