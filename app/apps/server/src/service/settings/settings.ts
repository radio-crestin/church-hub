import { eq, sql } from 'drizzle-orm'

import type { Setting, SettingsTable, UpsertSettingInput } from './types'
import { getDatabase } from '../../db'
import { appSettings, cacheMetadata, userPreferences } from '../../db/schema'
import type { OperationResult } from '../users'

const DEBUG = process.env.DEBUG === 'true'

// Map table names to schema tables
const tableMap = {
  app_settings: appSettings,
  user_preferences: userPreferences,
  cache_metadata: cacheMetadata,
} as const

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
    const schemaTable = tableMap[table]

    db.insert(schemaTable)
      .values({
        key: input.key,
        value: input.value,
      })
      .onConflictDoUpdate({
        target: schemaTable.key,
        set: {
          value: input.value,
          updatedAt: sql`(unixepoch())`,
        },
      })
      .run()

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
    const schemaTable = tableMap[table]

    // Check if setting exists first
    const existing = db
      .select()
      .from(schemaTable)
      .where(eq(schemaTable.key, key))
      .get()

    if (!existing) {
      log('warning', `Setting not found: ${key}`)
      return { success: false, error: 'Setting not found' }
    }

    db.delete(schemaTable).where(eq(schemaTable.key, key)).run()

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
    const schemaTable = tableMap[table]

    const result = db
      .select({
        id: schemaTable.id,
        key: schemaTable.key,
        value: schemaTable.value,
        created_at: schemaTable.createdAt,
        updated_at: schemaTable.updatedAt,
      })
      .from(schemaTable)
      .where(eq(schemaTable.key, key))
      .get()

    if (!result) {
      log('debug', `Setting not found: ${key}`)
      return null
    }

    log('debug', `Setting retrieved: ${key}`)
    return {
      id: result.id,
      key: result.key,
      value: result.value,
      created_at:
        result.created_at instanceof Date
          ? Math.floor(result.created_at.getTime() / 1000)
          : (result.created_at as number),
      updated_at:
        result.updated_at instanceof Date
          ? Math.floor(result.updated_at.getTime() / 1000)
          : (result.updated_at as number),
    }
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
    const schemaTable = tableMap[table]

    const results = db
      .select({
        id: schemaTable.id,
        key: schemaTable.key,
        value: schemaTable.value,
        created_at: schemaTable.createdAt,
        updated_at: schemaTable.updatedAt,
      })
      .from(schemaTable)
      .orderBy(schemaTable.key)
      .all()

    log('debug', `Retrieved ${results.length} settings`)
    return results.map((r) => ({
      id: r.id,
      key: r.key,
      value: r.value,
      created_at:
        r.created_at instanceof Date
          ? Math.floor(r.created_at.getTime() / 1000)
          : (r.created_at as number),
      updated_at:
        r.updated_at instanceof Date
          ? Math.floor(r.updated_at.getTime() / 1000)
          : (r.updated_at as number),
    }))
  } catch (error) {
    log('error', `Failed to get all settings: ${error}`)
    return []
  }
}
