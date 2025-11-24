import type { Theme, ThemePreference } from './types'
import { getSetting, upsertSetting } from '../settings/settings'

const THEME_SETTING_KEY = 'theme'

/**
 * Detects the system theme preference from the browser
 * Returns 'light' or 'dark' based on system preference, defaults to 'dark'
 */
export function detectSystemTheme(): Theme {
  if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
    return 'light'
  }

  // Default to dark
  return 'dark'
}

/**
 * Gets the saved theme preference from the database
 * Returns null if no preference is saved
 */
export async function getThemePreference(): Promise<ThemePreference | null> {
  const setting = await getSetting('app_settings', THEME_SETTING_KEY)

  if (!setting) {
    return null
  }

  const value = setting.value as ThemePreference

  // Validate the value
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value
  }

  return null
}

/**
 * Saves the theme preference to the database
 */
export async function saveThemePreference(
  preference: ThemePreference,
): Promise<boolean> {
  return await upsertSetting('app_settings', {
    key: THEME_SETTING_KEY,
    value: preference,
  })
}

/**
 * Resolves the actual theme to use based on preference
 * If preference is 'system', detects system theme
 * If preference is a specific theme, returns that theme
 * If no preference is set, detects system theme
 */
export function resolveTheme(preference: ThemePreference | null): Theme {
  if (!preference || preference === 'system') {
    return detectSystemTheme()
  }

  return preference
}

/**
 * Gets the effective theme to use
 * Combines getting the preference and resolving it to an actual theme
 */
export async function getEffectiveTheme(): Promise<Theme> {
  const preference = await getThemePreference()
  return resolveTheme(preference)
}
