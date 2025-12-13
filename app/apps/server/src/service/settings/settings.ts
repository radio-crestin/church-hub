import type { Setting, SettingsTable, UpsertSettingInput } from './types'
import { getDatabase } from '../../db'
import type { OperationResult } from '../users'

const DEBUG = process.env.DEBUG === 'true'

/**
 * Logs debug messages if DEBUG env variable is enabled
 */
function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
}

/**
 * Upserts a setting in the specified table
 * Creates a new record if key doesn't exist, updates if it does
 */
export function upsertSetting(
  table: SettingsTable,
  input: UpsertSettingInput,
): OperationResult {
  try {
    log('debug', `Upserting setting: ${input.key} in table: ${table}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000) // Unix timestamp in seconds

    const query = db.query(`
      INSERT INTO ${table} (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)

    query.run(input.key, input.value, now, now)

    log('info', `Setting upserted successfully: ${input.key}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to upsert setting: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Deletes a setting from the specified table
 */
export function deleteSetting(
  table: SettingsTable,
  key: string,
): OperationResult {
  try {
    log('debug', `Deleting setting: ${key} from table: ${table}`)

    const db = getDatabase()
    const query = db.query(`DELETE FROM ${table} WHERE key = ?`)
    query.run(key)

    // Check if any rows were affected by trying to get the setting
    const checkQuery = db.query(
      `SELECT COUNT(*) as count FROM ${table} WHERE key = ?`,
    )
    const beforeCount = (checkQuery.get(key) as any)?.count || 0

    if (beforeCount > 0) {
      log('warning', `Setting not found: ${key}`)
      return { success: false, error: 'Setting not found' }
    }

    log('info', `Setting deleted successfully: ${key}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to delete setting: ${error}`)
    return { success: false, error: String(error) }
  }
}

/**
 * Gets a setting by key from the specified table
 * Returns null if not found
 */
export function getSetting(table: SettingsTable, key: string): Setting | null {
  try {
    log('debug', `Getting setting: ${key} from table: ${table}`)

    const db = getDatabase()
    const query = db.query(`SELECT * FROM ${table} WHERE key = ?`)
    const result = query.get(key) as Setting | null

    if (!result) {
      log('debug', `Setting not found: ${key}`)
      return null
    }

    log('debug', `Setting retrieved: ${key}`)
    return result
  } catch (error) {
    log('error', `Failed to get setting: ${error}`)
    return null
  }
}

/**
 * Gets all settings from the specified table
 */
export function getAllSettings(table: SettingsTable): Setting[] {
  try {
    log('debug', `Getting all settings from table: ${table}`)

    const db = getDatabase()
    const query = db.query(`SELECT * FROM ${table} ORDER BY key ASC`)
    const results = query.all() as Setting[]

    log('debug', `Retrieved ${results.length} settings`)
    return results
  } catch (error) {
    log('error', `Failed to get all settings: ${error}`)
    return []
  }
}
