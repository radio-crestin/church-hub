import { useEffect, useRef } from 'react'

import { useScreens } from './useScreens'
import { createLogger } from '../../../utils/logger'
import { isTauri, openAllActiveScreens } from '../utils/openDisplayWindow'

const logger = createLogger('app:screen')

/**
 * Hook that automatically opens all active screens on app startup
 * Only runs once when screens are first loaded
 */
export function useAutoOpenScreens(): void {
  const { data: screens, isSuccess } = useScreens()
  const hasOpenedRef = useRef(false)

  useEffect(() => {
    // Only run once, only in Tauri, and only after screens are loaded
    if (hasOpenedRef.current || !isSuccess || !screens || !isTauri()) {
      return
    }

    hasOpenedRef.current = true

    // Open all active screens
    openAllActiveScreens(screens).catch((error) => {
      logger.error('Failed to auto-open screens:', error)
    })
  }, [screens, isSuccess])
}
