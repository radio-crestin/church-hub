import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[assign-default-page-keys:${level}] ${message}`)
}

const MIGRATION_KEY = 'assign_default_page_keys_v1'
const SHORTCUT_SETTING_KEYS = [
  'sidebar_configuration',
  'global_keyboard_shortcuts',
]

/**
 * The default sidebar keys, F4 upward in the sidebar's order. New installs get
 * them from default-settings.json; keep the two in step.
 */
const DEFAULT_PAGE_KEYS: Record<string, string> = {
  present: 'F4',
  songs: 'F5',
  bible: 'F6',
  schedules: 'F7',
  music: 'F8',
  song_key: 'F9',
  live_translation: 'F10',
  livestream: 'F11',
}

interface SidebarItem {
  builtinId?: string
  settings?: { shortcuts?: string[] }
}

/**
 * Gives an existing install the default page keys, only where the page has no
 * key and nothing else already uses that key. Runs once.
 */
export function assignDefaultPageKeys(db: Database): void {
  if (readSetting(db, MIGRATION_KEY) !== null) {
    log('debug', 'Already applied, skipping')
    return
  }

  const sidebarJson = readSetting(db, 'sidebar_configuration')
  if (!sidebarJson) {
    markComplete(db, [])
    return
  }

  const usedKeys = collectUsedKeys(db)
  const config = JSON.parse(sidebarJson) as { items?: SidebarItem[] }
  const assigned: string[] = []
  for (const item of config.items ?? []) {
    const key = item.builtinId && DEFAULT_PAGE_KEYS[item.builtinId]
    if (!key || !item.settings || usedKeys.has(key)) continue
    if ((item.settings.shortcuts ?? []).length > 0) continue
    item.settings.shortcuts = [key]
    usedKeys.add(key)
    assigned.push(`${item.builtinId}=${key}`)
  }

  if (assigned.length > 0) {
    db.run(
      'UPDATE app_settings SET value = ?, updated_at = unixepoch() WHERE key = ?',
      [JSON.stringify(config), 'sidebar_configuration'],
    )
  }
  log('info', `Assigned: ${assigned.join(', ') || 'none'}`)
  markComplete(db, assigned)
}

/** Every key any shortcut setting holds, read as the quoted strings in it. */
function collectUsedKeys(db: Database): Set<string> {
  const used = new Set<string>()
  for (const settingKey of SHORTCUT_SETTING_KEYS) {
    const value = readSetting(db, settingKey) ?? ''
    for (const [, key] of value.matchAll(/"(F\d{1,2})"/g)) used.add(key)
  }
  return used
}

function readSetting(db: Database, key: string): string | null {
  return (
    db
      .query<{ value: string }, [string]>(
        'SELECT value FROM app_settings WHERE key = ?',
      )
      .get(key)?.value ?? null
  )
}

function markComplete(db: Database, assigned: string[]): void {
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify({ assigned })],
  )
}
