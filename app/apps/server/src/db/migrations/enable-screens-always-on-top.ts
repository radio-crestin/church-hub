import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[enable-screens-always-on-top:${level}] ${message}`)
}

const MIGRATION_KEY = 'enable_screens_always_on_top_v1'

/**
 * Turns "always on top" on for every existing screen, once.
 *
 * Projection windows used to start with normal stacking, so a web page opened
 * on the projector's display covered the slides (T-026). Screens are now on
 * top by default; this brings existing installs along. It runs only once, so
 * an operator who later turns it off for a screen keeps it off.
 */
export function enableScreensAlwaysOnTop(db: Database): void {
  const applied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (applied && applied > 0) {
    log('debug', 'Migration already applied, skipping')
    return
  }

  const { changes } = db.run(
    'UPDATE screens SET always_on_top = 1 WHERE always_on_top = 0',
  )
  log('info', `Set always on top for ${changes} screen(s)`)

  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ success: true })],
  )
}
