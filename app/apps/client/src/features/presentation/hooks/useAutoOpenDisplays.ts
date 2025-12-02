import { useEffect, useRef } from 'react'

import { useDisplays } from './useDisplays'
import { createLogger } from '../../../utils/logger'
import { isTauri, openAllActiveDisplays } from '../utils/openDisplayWindow'

const logger = createLogger('app:display')

/**
 * Hook that automatically opens all active native displays on app startup
 * Only runs once when displays are first loaded
 */
export function useAutoOpenDisplays(): void {
  const { data: displays, isSuccess } = useDisplays()
  const hasOpenedRef = useRef(false)

  useEffect(() => {
    // Only run once, only in Tauri, and only after displays are loaded
    if (hasOpenedRef.current || !isSuccess || !displays || !isTauri()) {
      return
    }

    hasOpenedRef.current = true

    // Open all active native displays
    openAllActiveDisplays(displays).catch((error) => {
      logger.error('Failed to auto-open displays:', error)
    })
  }, [displays, isSuccess])
}
