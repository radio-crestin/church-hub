import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-close-on-escape:${level}] ${message}`)
}

const MIGRATION_KEY_V1 = 'add_close_on_escape_v1'
const MIGRATION_KEY_V2 = 'add_close_on_escape_v2_default_off'

/**
 * Add close_on_escape column to screens table (default false).
 * When true, the screen's Tauri window closes on Escape and re-opens on the
 * next presentation. When false (default), the window stays open showing
 * the clock.
 *
 * Migration history:
 *  - v1: introduced close_on_escape with DEFAULT 1. Also migrated from the
 *    earlier `keep_visible_on_escape` column (inverted semantics).
 *  - v2: flipped the default to 0 (stay open). On databases where v1 was
 *    already applied, all existing rows are reset to 0 to match the new
 *    default behavior (the feature was brand new and not yet tuned per
 *    screen).
 */
export function addCloseOnEscape(db: Database): void {
  const v2Applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY_V2)?.count

  if (v2Applied && v2Applied > 0) {
    log('debug', 'Migration v2 already applied, skipping')
    return
  }

  const columns = db
    .query<{ name: string }, []>('PRAGMA table_info(screens)')
    .all()

  const hasNew = columns.some((col) => col.name === 'close_on_escape')
  const hasOld = columns.some((col) => col.name === 'keep_visible_on_escape')

  if (!hasNew) {
    log('info', 'Adding "close_on_escape" column (default 0)...')
    db.run(
      'ALTER TABLE screens ADD COLUMN close_on_escape INTEGER NOT NULL DEFAULT 0',
    )
  }

  if (hasOld) {
    log(
      'info',
      'Migrating values from keep_visible_on_escape -> close_on_escape (inverted)...',
    )
    db.run(
      'UPDATE screens SET close_on_escape = CASE WHEN keep_visible_on_escape = 1 THEN 0 ELSE 1 END',
    )

    try {
      db.run('ALTER TABLE screens DROP COLUMN keep_visible_on_escape')
      log('info', 'Dropped legacy keep_visible_on_escape column')
    } catch (error) {
      log(
        'warning',
        `Could not drop keep_visible_on_escape (SQLite < 3.35 or other): ${error}`,
      )
    }
  }

  const v1Applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY_V1)?.count

  if (v1Applied && v1Applied > 0) {
    log(
      'info',
      'Resetting existing screens to close_on_escape = 0 (v2 default flip)...',
    )
    db.run('UPDATE screens SET close_on_escape = 0')
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY_V1, JSON.stringify({ success: true })],
  )
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY_V2, JSON.stringify({ success: true })],
  )

  log('info', 'close_on_escape migration complete')
}
