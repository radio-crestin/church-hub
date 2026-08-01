import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-screen-open-on-startup:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_screen_open_on_startup_v1'

/**
 * Adds `open_on_startup` to `screens`: whether this screen's window is opened
 * automatically when the app launches.
 *
 * Until now `is_active` carried both meanings — "this screen has a window" and
 * "open it on launch" — so the startup set was implicitly whatever happened to
 * be open when the app was last closed. The two are now separate: a screen with
 * `open_on_startup = 0` stays closed at launch but still opens the moment
 * something is presented to it, after which it behaves like any other screen.
 *
 * Defaults to 1 so existing installs keep the exact behaviour they had (every
 * active screen opened on launch); operators opt out per screen.
 *
 * Idempotent — safe to run on every boot.
 */
export function addScreenOpenOnStartup(db: Database): void {
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

  if (!columns.some((col) => col.name === 'open_on_startup')) {
    log('info', 'Adding "open_on_startup" column to screens (default 1)...')
    db.run(
      'ALTER TABLE screens ADD COLUMN open_on_startup INTEGER NOT NULL DEFAULT 1',
    )
  }

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
