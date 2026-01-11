import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrate-shortcuts:${level}] ${message}`)
}

const MIGRATION_KEY = 'migrate_shortcuts_cleanup_v2'

// Legacy action IDs that were removed from the codebase
const LEGACY_ACTION_IDS = ['searchSong', 'searchBible']

/**
 * Clean up legacy searchSong and searchBible shortcuts from global_keyboard_shortcuts
 * These actions were removed from the codebase and replaced with per-sidebar-item shortcuts
 */
export function migrateShortcuts(db: Database): void {
  // Check if migration already applied
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'Shortcuts migration already applied, skipping')
    return
  }

  log('info', 'Starting shortcuts cleanup migration...')

  // Get current global keyboard shortcuts
  const setting = db
    .query<{ value: string }, [string]>(
      'SELECT value FROM app_settings WHERE key = ?',
    )
    .get('global_keyboard_shortcuts')

  if (!setting?.value) {
    log(
      'info',
      'No global_keyboard_shortcuts setting found, skipping migration',
    )
    markMigrationComplete(db, { cleaned: false, reason: 'no_setting' })
    return
  }

  try {
    const config = JSON.parse(setting.value)

    if (!config.actions) {
      log('info', 'No actions in global_keyboard_shortcuts, skipping migration')
      markMigrationComplete(db, { cleaned: false, reason: 'no_actions' })
      return
    }

    // Remove legacy action IDs
    let removedCount = 0
    for (const actionId of LEGACY_ACTION_IDS) {
      if (actionId in config.actions) {
        delete config.actions[actionId]
        removedCount++
        log('info', `Removed legacy action: ${actionId}`)
      }
    }

    if (removedCount === 0) {
      log('info', 'No legacy actions found, skipping migration')
      markMigrationComplete(db, { cleaned: false, reason: 'no_legacy_actions' })
      return
    }

    // Update the setting with cleaned config
    const cleanedValue = JSON.stringify(config)
    db.run(
      'UPDATE app_settings SET value = ?, updated_at = unixepoch() WHERE key = ?',
      [cleanedValue, 'global_keyboard_shortcuts'],
    )

    log(
      'info',
      `Removed ${removedCount} legacy action(s) from global_keyboard_shortcuts`,
    )
    markMigrationComplete(db, { cleaned: true, removedCount })
  } catch (error) {
    log('error', `Failed to parse global_keyboard_shortcuts: ${error}`)
    markMigrationComplete(db, { cleaned: false, reason: 'parse_error' })
  }
}

function markMigrationComplete(
  db: Database,
  result: { cleaned: boolean; removedCount?: number; reason?: string },
): void {
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify(result)],
  )
  log('info', 'Shortcuts cleanup migration complete')
}
