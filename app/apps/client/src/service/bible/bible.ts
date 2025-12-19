import { getSetting, upsertSetting } from '../settings/settings'

const DEFAULT_BIBLE_TRANSLATION_KEY = 'default_bible_translation'
const SELECTED_BIBLE_TRANSLATIONS_KEY = 'selected_bible_translations'

const MAX_TRANSLATIONS = 3

/**
 * Gets the saved default Bible translation ID from the database
 * Returns null if no preference is saved
 */
export async function getDefaultBibleTranslationId(): Promise<number | null> {
  const setting = await getSetting(
    'app_settings',
    DEFAULT_BIBLE_TRANSLATION_KEY,
  )

  if (!setting) {
    return null
  }

  const value = parseInt(setting.value, 10)

  // Validate the value is a valid number
  if (Number.isNaN(value)) {
    return null
  }

  return value
}

/**
 * Saves the default Bible translation ID to the database
 */
export async function saveDefaultBibleTranslationId(
  translationId: number,
): Promise<boolean> {
  return await upsertSetting('app_settings', {
    key: DEFAULT_BIBLE_TRANSLATION_KEY,
    value: String(translationId),
  })
}

/**
 * Gets the saved selected Bible translation IDs from the database
 * Returns an empty array if no preference is saved
 */
export async function getSelectedBibleTranslationIds(): Promise<number[]> {
  const setting = await getSetting(
    'app_settings',
    SELECTED_BIBLE_TRANSLATIONS_KEY,
  )

  if (!setting) {
    // Migration: Check for old default translation setting
    const defaultId = await getDefaultBibleTranslationId()
    if (defaultId !== null) {
      return [defaultId]
    }
    return []
  }

  try {
    const parsed = JSON.parse(setting.value)
    if (Array.isArray(parsed.translationIds)) {
      return parsed.translationIds
        .filter((id: unknown): id is number => typeof id === 'number')
        .slice(0, MAX_TRANSLATIONS)
    }
    return []
  } catch {
    return []
  }
}

/**
 * Saves the selected Bible translation IDs to the database
 * Enforces maximum of 3 translations
 */
export async function saveSelectedBibleTranslationIds(
  translationIds: number[],
): Promise<boolean> {
  const limitedIds = translationIds.slice(0, MAX_TRANSLATIONS)
  return await upsertSetting('app_settings', {
    key: SELECTED_BIBLE_TRANSLATIONS_KEY,
    value: JSON.stringify({ translationIds: limitedIds }),
  })
}
