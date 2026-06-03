/**
 * Remembers the settings section the operator last had open so that leaving
 * Settings (to another sidebar page) and coming back reopens the same section
 * instead of always jumping to the first one.
 *
 * Stored in `localStorage`: it's a personal, per-device UI preference, not
 * shared application state (same rationale as divider positions).
 */
const LAST_SETTINGS_SECTION_KEY = 'settings.last_section'

export function getLastSettingsSection(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LAST_SETTINGS_SECTION_KEY)
  } catch {
    return null
  }
}

export function setLastSettingsSection(pathname: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_SETTINGS_SECTION_KEY, pathname)
  } catch {
    // Ignore quota/availability errors — non-critical UI state.
  }
}
