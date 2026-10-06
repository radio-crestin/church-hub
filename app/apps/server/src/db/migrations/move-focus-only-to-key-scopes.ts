import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[move-focus-only-to-key-scopes:${level}] ${message}`)
}

const SETTING_KEY = 'global_keyboard_shortcuts'

interface ShortcutsConfig {
  actions?: Record<string, { shortcuts?: string[] }>
  onlyWhenAppFocused?: boolean
  keyScopes?: Record<string, 'app' | 'system'>
}

/**
 * Where a key works is now chosen per key (`keyScopes`), replacing the one
 * "only when Church Hub is in front" switch for all presentation, livestream
 * and OBS scene keys. An install that had the switch on gets each of those
 * keys set to work only in Church Hub; the switch itself is removed. Runs
 * until the switch is gone, so once.
 */
export function moveFocusOnlyToKeyScopes(db: Database): void {
  const value = db
    .query<{ value: string }, [string]>(
      'SELECT value FROM app_settings WHERE key = ?',
    )
    .get(SETTING_KEY)?.value
  if (!value) return

  const config = JSON.parse(value) as ShortcutsConfig
  if (!('onlyWhenAppFocused' in config)) {
    log('debug', 'No focus-only switch, skipping')
    return
  }

  const appOnlyKeys = config.onlyWhenAppFocused
    ? [...actionKeys(config), ...sceneKeys(db)]
    : []
  const keyScopes = { ...config.keyScopes }
  for (const key of appOnlyKeys) keyScopes[key] ??= 'app'
  config.onlyWhenAppFocused = undefined

  db.run(
    'UPDATE app_settings SET value = ?, updated_at = unixepoch() WHERE key = ?',
    [JSON.stringify({ ...config, keyScopes }), SETTING_KEY],
  )
  log('info', `Set to Church Hub only: ${appOnlyKeys.join(', ') || 'none'}`)
}

function isKeyboardKey(key: string): boolean {
  return Boolean(key) && !key.startsWith('midi:')
}

function actionKeys(config: ShortcutsConfig): string[] {
  return Object.values(config.actions ?? {})
    .flatMap((action) => action.shortcuts ?? [])
    .filter(isKeyboardKey)
}

function sceneKeys(db: Database): string[] {
  return db
    .query<{ shortcuts: string }, []>('SELECT shortcuts FROM obs_scenes')
    .all()
    .flatMap((row) => JSON.parse(row.shortcuts) as string[])
    .filter(isKeyboardKey)
}
