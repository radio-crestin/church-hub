import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-close-on-escape:${level}] ${message}`)
}

const MIGRATION_KEY_V1 = 'add_close_on_escape_v1'
const MIGRATION_KEY_V2 = 'add_close_on_escape_v2_default_off'
const MIGRATION_KEY_V3 = 'add_close_on_escape_v3_factory_off'

/**
 * Add close_on_escape column to screens table (default false).
 * When true, the screen's Tauri window closes on Escape and re-opens on the
 * next presentation. When false (default), the window stays open showing
 * the clock.
 *
 * Migration history:
 *  - v1: introduced close_on_escape with DEFAULT 1. Also migrated from the
 *    earlier `keep_visible_on_escape` column (inverted semantics).
 *  - v2: flipped the default to 0 (stay open) and reset existing rows to 0.
 *  - v3: the legacy column DEFAULT is still 1, so screens re-seeded after v2
 *    (or created from the old default) came back as 1. The factory default is
 *    OFF, so do one final one-time alignment — reset every screen to 0 so the
 *    window stays open when nothing is displayed. After this runs once,
 *    operators can freely toggle per screen.
 */
export function addCloseOnEscape(db: Database): void {
  // 1. Ensure the column exists and migrate the legacy column (idempotent).
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

  // 2. One-time factory-default alignment: reset every screen to 0 (off).
  const v3Applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY_V3)?.count

  if (!v3Applied || v3Applied === 0) {
    log('info', 'Resetting all screens to close_on_escape = 0 (factory off)...')
    db.run('UPDATE screens SET close_on_escape = 0')

    for (const key of [MIGRATION_KEY_V1, MIGRATION_KEY_V2, MIGRATION_KEY_V3]) {
      db.run(
        'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
        [key, JSON.stringify({ success: true })],
      )
    }
  }

  log('info', 'close_on_escape migration complete')
}
