/**
 * Setting record structure
 */
export interface Setting {
  id: number
  key: string
  value: string
  created_at: number
  updated_at: number
}

/**
 * Table types for settings
 */
export type SettingsTable =
  | 'app_settings'
  | 'user_preferences'
  | 'cache_metadata'

/**
 * Input for upserting a setting
 */
export interface UpsertSettingInput {
  key: string
  value: string
}
