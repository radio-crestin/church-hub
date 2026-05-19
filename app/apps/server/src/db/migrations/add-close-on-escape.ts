import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-close-on-escape:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_close_on_escape_v1'

/**
 * Add close_on_escape column to screens table (default true).
 * When true, the screen's Tauri window closes on Escape and re-opens on the
 * next presentation. When false, the window stays open showing the clock.
 *
 * Also migrates from the earlier `keep_visible_on_escape` column if present:
 * inverts the values (NOT keep_visible) and drops the legacy column.
 */
export function addCloseOnEscape(db: Database): void {
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
    .query<{ name: string }, []>('PRAGMA table_info(screens)')
    .all()

  const hasNew = columns.some((col) => col.name === 'close_on_escape')
  const hasOld = columns.some((col) => col.name === 'keep_visible_on_escape')

  if (!hasNew) {
    log('info', 'Adding "close_on_escape" column (default 1)...')
    db.run(
      'ALTER TABLE screens ADD COLUMN close_on_escape INTEGER NOT NULL DEFAULT 1',
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

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )

  log('info', 'close_on_escape migration complete')
}
