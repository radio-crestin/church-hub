import { idByUuid } from './idByUuid'
import { getRawDatabase } from '../../../db'
import { SYNCED_SETTING_KEYS } from '../syncedTables'
import type { LibrarySetting } from '../types'

const KEYS: ReadonlySet<string> = new Set(SYNCED_SETTING_KEYS)

/** The church-wide settings; a setting's uuid is its key. */
export function serializeSettings(): LibrarySetting[] {
  return getRawDatabase()
    .query<LibrarySetting, []>(
      `SELECT key AS uuid, value, created_at AS createdAt,
              updated_at AS updatedAt
         FROM app_settings`,
    )
    .all()
    .filter((setting) => KEYS.has(setting.uuid))
}

/** Only a church-wide key is ever written: nothing else comes from afar. */
export function upsertSetting(setting: LibrarySetting): number | null {
  if (!KEYS.has(setting.uuid)) return null
  getRawDatabase()
    .query(
      `INSERT INTO app_settings (key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET
         value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(setting.uuid, setting.value, setting.createdAt, setting.updatedAt)
  return idByUuid('app_settings', setting.uuid, 'key')
}
