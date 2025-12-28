import { useKioskWakeLock } from '../hooks/useKioskWakeLock'

/**
 * Component that manages screen wake lock
 * Renders nothing - just handles the wake lock lifecycle
 *
 * Wake lock is always enabled to prevent the screen from turning off
 * during church presentations and worship sessions
 */
export function KioskWakeLockManager() {
  useKioskWakeLock({ enabled: true })

  return null
}
