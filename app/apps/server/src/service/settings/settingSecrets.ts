import type { Setting } from './types'
import { hideSecrets, type SecretFlags } from '../../utils/hideSecrets'

/**
 * App settings whose JSON value holds secrets, and the flags that replace
 * them for whoever may only read settings (not change them).
 */
export const SETTING_SECRETS: Record<string, SecretFlags> = {
  live_translation_settings: {
    geminiApiKey: 'geminiKeySet',
    openaiApiKey: 'openaiKeySet',
  },
  songs_ai_search_config: { apiKey: 'apiKeySet' },
  bible_ai_search_config: { apiKey: 'apiKeySet' },
}

/** The setting as a reader without `settings.edit` may see it. */
export function withoutSettingSecrets(setting: Setting): Setting {
  const flags = SETTING_SECRETS[setting.key]
  if (!flags) return setting
  try {
    const value = JSON.parse(setting.value) as object
    return { ...setting, value: JSON.stringify(hideSecrets(value, flags)) }
  } catch {
    return { ...setting, value: '' }
  }
}
