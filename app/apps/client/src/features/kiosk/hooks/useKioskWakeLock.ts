import { useEffect, useState } from 'react'

import {
  acquireWakeLock,
  isWakeLockActive,
  isWakeLockSupported,
  releaseWakeLock,
} from '../service/wakeLockService'

interface UseKioskWakeLockOptions {
  enabled: boolean
}

interface UseKioskWakeLockResult {
  isSupported: boolean
  isActive: boolean
}

/**
 * Hook to manage screen wake lock for kiosk mode
 * Automatically acquires wake lock when enabled and releases when disabled
 * Also handles visibility changes to reacquire lock when page becomes visible
 */
export function useKioskWakeLock({
  enabled,
}: UseKioskWakeLockOptions): UseKioskWakeLockResult {
  const [isActive, setIsActive] = useState(false)
  const isSupported = isWakeLockSupported()

  useEffect(() => {
    if (!enabled || !isSupported) {
      // Release wake lock if disabled
      if (isWakeLockActive()) {
        releaseWakeLock()
        setIsActive(false)
      }
      return
    }

    // Acquire wake lock when enabled
    const acquire = async () => {
      const success = await acquireWakeLock()
      setIsActive(success)
    }

    acquire()

    // Handle visibility change - reacquire when page becomes visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && enabled) {
        const success = await acquireWakeLock()
        setIsActive(success)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup: release wake lock and remove listener
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseWakeLock()
      setIsActive(false)
    }
  }, [enabled, isSupported])

  return {
    isSupported,
    isActive,
  }
}
