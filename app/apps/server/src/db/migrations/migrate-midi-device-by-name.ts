import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[migrate-midi-device-by-name:${level}] ${message}`)
}

const MIGRATION_KEY = 'migrate_midi_device_by_name_v1'

/**
 * Convert legacy MIDI device persistence from index-based IDs to name-based IDs.
 *
 * Old shape: { midi: { inputDeviceId: "3", outputDeviceId: "4" } }
 * New shape: { midi: { inputDeviceName: <name|null>, outputDeviceName: <name|null> } }
 *
 * We do NOT attempt to resolve the stale index → current device name at
 * migration time: indices are unstable across reboots and plug order, which
 * is the exact reason we're moving to names. Resolving here could silently
 * bind to the wrong controller. Clearing the value forces a one-time
 * re-selection by the user, after which the binding is durable.
 */
export function migrateMidiDeviceByName(db: Database): void {
  const migrationApplied = db
    .query<{ count: number }, [string]>(
      'SELECT COUNT(*) as count FROM app_settings WHERE key = ?',
    )
    .get(MIGRATION_KEY)?.count

  if (migrationApplied && migrationApplied > 0) {
    log('debug', 'MIDI device-by-name migration already applied, skipping')
    return
  }

  const setting = db
    .query<{ value: string }, [string]>(
      'SELECT value FROM app_settings WHERE key = ?',
    )
    .get('global_keyboard_shortcuts')

  if (!setting?.value) {
    markMigrationComplete(db, { migrated: false, reason: 'no_setting' })
    return
  }

  try {
    const config = JSON.parse(setting.value) as {
      midi?: Record<string, unknown>
    }

    if (!config.midi) {
      markMigrationComplete(db, { migrated: false, reason: 'no_midi_config' })
      return
    }

    const midi = config.midi
    const hadInputId = 'inputDeviceId' in midi
    const hadOutputId = 'outputDeviceId' in midi
    const hasNewKeys = 'inputDeviceName' in midi || 'outputDeviceName' in midi

    if (!hadInputId && !hadOutputId && hasNewKeys) {
      markMigrationComplete(db, { migrated: false, reason: 'already_new_shape' })
      return
    }

    delete midi.inputDeviceId
    delete midi.outputDeviceId

    if (!('inputDeviceName' in midi)) midi.inputDeviceName = null
    if (!('outputDeviceName' in midi)) midi.outputDeviceName = null

    db.run(
      'UPDATE app_settings SET value = ?, updated_at = unixepoch() WHERE key = ?',
      [JSON.stringify(config), 'global_keyboard_shortcuts'],
    )

    log(
      'info',
      `Converted MIDI device persistence to name-based (cleared legacy indices: input=${hadInputId}, output=${hadOutputId})`,
    )
    markMigrationComplete(db, { migrated: true, hadInputId, hadOutputId })
  } catch (error) {
    log('error', `Failed to migrate MIDI device persistence: ${error}`)
    markMigrationComplete(db, { migrated: false, reason: 'parse_error' })
  }
}

function markMigrationComplete(
  db: Database,
  result: Record<string, unknown>,
): void {
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value, created_at, updated_at) VALUES (?, ?, unixepoch(), unixepoch())',
    [MIGRATION_KEY, JSON.stringify(result)],
  )
}
