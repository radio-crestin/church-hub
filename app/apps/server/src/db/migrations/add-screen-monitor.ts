import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-screen-monitor:${level}] ${message}`)
}

const MIGRATION_KEY = 'add_screen_monitor_v1'

/**
 * Adds `monitor_name` to `screens`: the physical display the projection window
 * belongs on.
 *
 * Nothing recorded which monitor a screen was shown on, so a window that was
 * closed came back wherever the OS decided to put it — on a three-monitor desk
 * the projection kept landing on the wrong one. The name is the monitor's own
 * (`Built-in Retina Display`, `\\.\DISPLAY1`, `HDMI-1`); NULL means "wherever it
 * opens", the behaviour every existing screen has today. It is written both by
 * the operator's choice in the screens settings and by the window itself when it
 * is dragged to another monitor, so the two stay in step.
 *
 * Also turns `is_fullscreen` on everywhere. A projection window used to be
 * force-promoted to fullscreen the moment it maximised, so every screen ran
 * fullscreen whatever the flag said; that promotion is gone and the flag is the
 * memory now, which would otherwise open those screens in a small window. A
 * screen that should run windowed says so from its own toolbar, and keeps it.
 *
 * Idempotent — safe to run on every boot.
 */
export function addScreenMonitor(db: Database): void {
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

  if (!columns.some((col) => col.name === 'monitor_name')) {
    log('info', 'Adding "monitor_name" column to screens...')
    db.run('ALTER TABLE screens ADD COLUMN monitor_name TEXT')
  }

  log('info', 'Defaulting existing screens to fullscreen...')
  db.run('UPDATE screens SET is_fullscreen = 1 WHERE is_fullscreen = 0')

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
