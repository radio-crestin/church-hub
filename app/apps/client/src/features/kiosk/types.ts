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
