/**
 * Kiosk startup page options
 */
export type KioskStartupPage =
  | { type: 'route'; path: string }
  | { type: 'screen'; screenId: number }

/**
 * Kiosk mode settings
 */
export interface KioskSettings {
  enabled: boolean
  startupPage: KioskStartupPage
}

/**
 * Kiosk settings keys in app_settings table
 */
export const KIOSK_SETTINGS_KEYS = {
  ENABLED: 'kiosk_mode_enabled',
  STARTUP_PAGE: 'kiosk_startup_page',
} as const

/**
 * Available app routes for kiosk startup
 */
export const KIOSK_ROUTE_OPTIONS = [
  { value: '/present', labelKey: 'present' },
  { value: '/songs', labelKey: 'songs' },
  { value: '/bible', labelKey: 'bible' },
  { value: '/schedules', labelKey: 'schedules' },
  { value: '/livestream', labelKey: 'livestream' },
  { value: '/settings', labelKey: 'settings' },
] as const
