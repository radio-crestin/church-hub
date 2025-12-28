import { getSetting, upsertSetting } from '../settings/settings'

const DEBUG_MODE_SETTING_KEY = 'debug_mode'

/**
 * Gets the debug mode setting from the database
 * Returns false if not set
 */
export async function getDebugMode(): Promise<boolean> {
  const setting = await getSetting('app_settings', DEBUG_MODE_SETTING_KEY)

  if (!setting) {
    return false
  }

  return setting.value === 'true'
}

/**
 * Saves the debug mode setting to the database
 */
export async function saveDebugMode(enabled: boolean): Promise<boolean> {
  return await upsertSetting('app_settings', {
    key: DEBUG_MODE_SETTING_KEY,
    value: enabled ? 'true' : 'false',
  })
}
