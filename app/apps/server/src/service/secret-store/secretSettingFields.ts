import type { SecretPlace } from './secretPlace'

/**
 * A settings row holding secrets: which fields are secret, and which fields
 * say where they are sent. A secret sent back as the mask is kept only
 * while its destination is unchanged (sealSettingValue).
 */
export interface SecretSetting {
  secrets: readonly string[]
  destination: readonly string[]
}

const AI_SEARCH: SecretSetting = {
  secrets: ['apiKey'],
  // A custom provider sends the key to its base URL.
  destination: ['provider', 'baseUrl'],
}

/**
 * The app_settings rows whose JSON value holds secrets: the one list. The
 * settings service seals these fields on every write, opens them for the
 * server's own reads and masks them in the settings API; sealStoredSecrets
 * seals what older versions stored; isSecretSettingKey keeps the rows out
 * of anything that leaves the computer.
 */
export const SECRET_SETTINGS: Readonly<Record<string, SecretSetting>> = {
  songs_ai_search_config: AI_SEARCH,
  bible_ai_search_config: AI_SEARCH,
  // Older versions' shared AI search config; still in some installs.
  ai_search_config: AI_SEARCH,
  live_translation_settings: {
    secrets: ['geminiApiKey', 'openaiApiKey'],
    // Each key only ever goes to its own provider's fixed endpoint.
    destination: [],
  },
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
