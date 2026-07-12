import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-song-slide-notes:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_song_slide_notes_v1'

/**
 * Adds the `notes` column to `song_slides` — a free-text speaker note per slide
 * (PowerPoint-style "what happens on this slide"), edited in the notes panel
 * below the stage canvas. Idempotent.
 */
export function addSongSlideNotes(db: Database): void {
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
  const hasColumn = columns.some((col) => col.name === 'notes')

  if (!hasColumn) {
    log('info', 'Adding "notes" column to song_slides table...')
    db.run('ALTER TABLE song_slides ADD COLUMN notes TEXT')
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
