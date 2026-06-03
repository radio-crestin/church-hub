import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-preview-screen:${level}] ${message}`)
}

const COLUMN_KEY = 'add_is_preview_screen_v1'
const DEFAULT_KEY = 'set_default_preview_screen_v1'

/**
 * Add is_preview_screen column to screens table (default false) and pick a
 * sensible default preview screen.
 *
 * When true, the screen is mirrored in the in-app control-room "Live preview"
 * panel. At most one screen is the preview screen at a time (enforced in the
 * screens service on upsert).
 *
 * Two independently-tracked steps:
 *  - COLUMN: add the column (idempotent).
 *  - DEFAULT: if no screen is flagged yet, flag the first primary screen (the
 *    "Main" screen). Fresh installs get this from the factory fixture, but this
 *    step backfills existing databases where the column was added empty.
 */
export function addPreviewScreen(db: Database): void {
  // --- Step 1: ensure the column exists -------------------------------------
  const columnApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(COLUMN_KEY)?.count

  if (!columnApplied || columnApplied === 0) {
    const columns = db
      .query<{ name: string }, []>('PRAGMA table_info(screens)')
      .all()
    const hasColumn = columns.some((col) => col.name === 'is_preview_screen')

    if (!hasColumn) {
      log('info', 'Adding "is_preview_screen" column (default 0)...')
      db.run(
        'ALTER TABLE screens ADD COLUMN is_preview_screen INTEGER NOT NULL DEFAULT 0',
      )
    }

    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [COLUMN_KEY, JSON.stringify({ success: true })],
    )
  }

  // --- Step 2: default the preview screen to the first primary --------------
  const defaultApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(DEFAULT_KEY)?.count

  if (!defaultApplied || defaultApplied === 0) {
    const flagged = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM screens WHERE is_preview_screen = 1',
      )
      .get()?.count

    if (!flagged || flagged === 0) {
      // Prefer the first primary screen; fall back to the lowest-sorted screen.
      const target = db
        .query<{ id: number }, []>(
          `SELECT id FROM screens
             ORDER BY (type = 'primary') DESC, sort_order ASC, id ASC
             LIMIT 1`,
        )
        .get()

      if (target) {
        log('info', `Defaulting preview screen to screen ${target.id}`)
        db.run('UPDATE screens SET is_preview_screen = 1 WHERE id = ?', [
          target.id,
        ])
      }
    }

    db.run(
      'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
      [DEFAULT_KEY, JSON.stringify({ success: true })],
    )
  }

  log('info', 'is_preview_screen migration complete')
}
