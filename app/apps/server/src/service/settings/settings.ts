import { eq, sql } from 'drizzle-orm'

import { isServerOwnedSettingKey } from './isServerOwnedSettingKey'
import type { Setting, SettingsTable, UpsertSettingInput } from './types'
import { getDatabase } from '../../db'
import { appSettings, cacheMetadata, userPreferences } from '../../db/schema'
import { toErrorMessage } from '../../utils/toErrorMessage'
import {
  maskSettingValue,
  openSettingValue,
  SecretDestinationChangedError,
  sealSettingValue,
} from '../secret-store'
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

/** The value as stored, secrets still sealed. */
function readStoredValue(table: SettingsTable, key: string): string | null {
  const schemaTable = tableMap[table]
  return (
    getDatabase()
      .select({ value: schemaTable.value })
      .from(schemaTable)
      .where(eq(schemaTable.key, key))
      .get()?.value ?? null
  )
}

/**
 * Upserts a setting in the specified table
 * Creates a new record if key doesn't exist, updates if it does. Secret
 * fields (secret-store/secretSettingFields) are sealed; one sent back as the
 * mask keeps the secret saved before, unless the save changes where it is
 * sent: then it throws SecretDestinationChangedError.
 */
export function upsertSetting(
  table: SettingsTable,
  input: UpsertSettingInput,
): OperationResult {
  try {
    log('debug', `Upserting setting: ${input.key} in table: ${table}`)

    const db = getDatabase()
    const schemaTable = tableMap[table]
    const value =
      table === 'app_settings'
        ? sealSettingValue(
            input.key,
            input.value,
            readStoredValue(table, input.key),
          )
        : input.value

    db.insert(schemaTable)
      .values({
        key: input.key,
        value,
      })
      .onConflictDoUpdate({
        target: schemaTable.key,
        set: {
          value,
          updatedAt: sql`(unixepoch())`,
        },
      })
      .run()

    log('info', `Setting upserted successfully: ${input.key}`)
    return { success: true }
  } catch (error) {
    // The caller answers this one (400): the key must be entered again.
    if (error instanceof SecretDestinationChangedError) throw error
    log('error', `Failed to upsert setting: ${error}`)
    return { success: false, error: toErrorMessage(error) }
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
    return { success: false, error: toErrorMessage(error) }
  }
}

/**
 * Gets a setting by key from the specified table, its secret fields opened:
 * for the server's own use (the settings API uses getPublicSetting).
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
      value:
        table === 'app_settings'
          ? openSettingValue(result.key, result.value)
          : result.value,
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

/** A setting as the settings API returns it: saved secrets masked. */
export function toPublicSetting(table: SettingsTable, setting: Setting) {
  return table === 'app_settings'
    ? { ...setting, value: maskSettingValue(setting.key, setting.value) }
    : setting
}

/** One setting for the settings API (toPublicSetting), or null. */
export function getPublicSetting(
  table: SettingsTable,
  key: string,
): Setting | null {
  const setting = getSetting(table, key)
  return setting && toPublicSetting(table, setting)
}

/**
 * Gets all settings from the specified table for the settings API: without
 * server secret keys, saved secrets masked
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
    return results
      .filter((r) => !isServerOwnedSettingKey(r.key))
      .map((r) => ({
        id: r.id,
        key: r.key,
        value:
          table === 'app_settings'
            ? maskSettingValue(r.key, openSettingValue(r.key, r.value))
            : r.value,
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
