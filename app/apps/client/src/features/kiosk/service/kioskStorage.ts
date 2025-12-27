/**
 * Kiosk settings localStorage service
 * Stores kiosk configuration per-device (not synced to database)
 */

import type { KioskSettings } from '../types'

const KIOSK_SETTINGS_STORAGE_KEY = 'church-hub-kiosk-settings'

const DEFAULT_SETTINGS: KioskSettings = {
  enabled: false,
  startupPage: { type: 'route', path: '/present' },
}

/**
 * Gets kiosk settings from localStorage (synchronous)
 * Returns default settings if not configured
 */
export function getKioskSettings(): KioskSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const stored = localStorage.getItem(KIOSK_SETTINGS_STORAGE_KEY)
    if (!stored) return DEFAULT_SETTINGS

    const parsed = JSON.parse(stored) as KioskSettings

    // Validate structure
    if (typeof parsed.enabled !== 'boolean') {
      return DEFAULT_SETTINGS
    }
    if (!parsed.startupPage || !parsed.startupPage.type) {
      return { ...parsed, startupPage: DEFAULT_SETTINGS.startupPage }
    }

    return parsed
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * Saves kiosk settings to localStorage
 */
export function setKioskSettings(settings: KioskSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage errors are not critical - silently fail
  }
}

/**
 * Updates partial kiosk settings
 */
export function updateKioskSettings(
  partial: Partial<KioskSettings>,
): KioskSettings {
  const current = getKioskSettings()
  const updated = { ...current, ...partial }
  setKioskSettings(updated)
  return updated
}

/**
 * Clears kiosk settings (resets to defaults)
 */
export function clearKioskSettings(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(KIOSK_SETTINGS_STORAGE_KEY)
  } catch {
    // Silently fail
  }
}

/**
 * Storage key constant for external use (e.g., storage event listener)
 */
export const STORAGE_KEY = KIOSK_SETTINGS_STORAGE_KEY
