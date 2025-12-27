import { useLocation } from '@tanstack/react-router'

import { useKioskSettings } from '../hooks/useKioskSettings'
import { useKioskWakeLock } from '../hooks/useKioskWakeLock'

/**
 * Component that manages screen wake lock for kiosk mode
 * Renders nothing - just handles the wake lock lifecycle
 *
 * Wake lock is enabled when:
 * 1. User is on a /screen/* route (always - these are display screens)
 * 2. User has enabled kiosk mode in settings (for other routes)
 */
export function KioskWakeLockManager() {
  const location = useLocation()
  const { data: kioskSettings } = useKioskSettings()

  // Always enable wake lock on screen routes (kiosk displays)
  const isScreenRoute = location.pathname.startsWith('/screen/')
  const kioskModeEnabled = kioskSettings?.enabled ?? false

  // Enable wake lock if on screen route OR kiosk mode is enabled
  const enabled = isScreenRoute || kioskModeEnabled

  useKioskWakeLock({ enabled })

  return null
}
