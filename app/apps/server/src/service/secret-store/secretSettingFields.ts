import type { SecretPlace } from './secretPlace'

/**
 * The app_settings rows whose JSON value holds secrets, and their fields:
 * the one list. The settings service seals these fields on every write,
 * opens them for the server's own reads and masks them in the settings
 * API; sealStoredSecrets seals what older versions stored.
 */
export const SECRET_SETTING_FIELDS: Readonly<
  Record<string, readonly string[]>
> = {
  songs_ai_search_config: ['apiKey'],
  bible_ai_search_config: ['apiKey'],
  // Older versions' shared AI search config; still in some installs.
  ai_search_config: ['apiKey'],
  live_translation_settings: ['geminiApiKey', 'openaiApiKey'],
}

export const settingPlace = (key: string, field: string): SecretPlace => ({
  table: 'app_settings',
  column: 'value',
  row: `${key}.${field}`,
})

/** A settings value as an object, or null when it isn't a JSON object. */
export function parseSettingObject(
  value: string,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
