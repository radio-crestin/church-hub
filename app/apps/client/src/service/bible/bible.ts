import { getSetting, upsertSetting } from '../settings/settings'

const DEFAULT_BIBLE_TRANSLATION_KEY = 'default_bible_translation'

/**
 * Gets the saved default Bible translation ID from the database
 * Returns null if no preference is saved
 */
export async function getDefaultBibleTranslationId(): Promise<number | null> {
  const setting = await getSetting('app_settings', DEFAULT_BIBLE_TRANSLATION_KEY)

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
