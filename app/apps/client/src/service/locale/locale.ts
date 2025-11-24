import type { Language, LanguagePreference } from './types'
import { getSetting, upsertSetting } from '../settings/settings'

const LANGUAGE_SETTING_KEY = 'language'

/**
 * Detects the system language from the browser
 * Returns 'en' or 'ro' based on system language, defaults to 'en'
 */
export function detectSystemLanguage(): Language {
  const systemLang = navigator.language.toLowerCase()

  // Check if Romanian
  if (systemLang.startsWith('ro')) {
    return 'ro'
  }

  // Default to English
  return 'en'
}

/**
 * Gets the saved language preference from the database
 * Returns null if no preference is saved
 */
export async function getLanguagePreference(): Promise<LanguagePreference | null> {
  const setting = await getSetting('app_settings', LANGUAGE_SETTING_KEY)

  if (!setting) {
    return null
  }

  const value = setting.value as LanguagePreference

  // Validate the value
  if (value === 'system' || value === 'en' || value === 'ro') {
    return value
  }

  return null
}

/**
 * Saves the language preference to the database
 */
export async function saveLanguagePreference(
  preference: LanguagePreference,
): Promise<boolean> {
  return await upsertSetting('app_settings', {
    key: LANGUAGE_SETTING_KEY,
    value: preference,
  })
}

/**
 * Resolves the actual language to use based on preference
 * If preference is 'system', detects system language
 * If preference is a specific language, returns that language
 * If no preference is set, detects system language
 */
export function resolveLanguage(
  preference: LanguagePreference | null,
): Language {
  if (!preference || preference === 'system') {
    return detectSystemLanguage()
  }

  return preference
}

/**
 * Gets the effective language to use
 * Combines getting the preference and resolving it to an actual language
 */
export async function getEffectiveLanguage(): Promise<Language> {
  const preference = await getLanguagePreference()
  return resolveLanguage(preference)
}
