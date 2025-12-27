import { useKioskSettings } from '../hooks/useKioskSettings'
import { useKioskWakeLock } from '../hooks/useKioskWakeLock'

/**
 * Component that manages screen wake lock for kiosk mode
 * Renders nothing - just handles the wake lock lifecycle
 */
export function KioskWakeLockManager() {
  const { data: kioskSettings } = useKioskSettings()
  const enabled = kioskSettings?.enabled ?? false

  useKioskWakeLock({ enabled })

  return null
}
