import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { dimScreen, restoreBrightness } from '../service/brightnessService'

const logger = createLogger('kiosk:screen-dim')

/** Delay before dimming screen after WebSocket disconnect (in milliseconds) */
const DIM_DELAY_MS = 60 * 1000 // 1 minute

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseKioskScreenDimOptions {
  kioskEnabled: boolean
  wsStatus: WebSocketStatus
}

interface UseKioskScreenDimResult {
  isOverlayVisible: boolean
  dismissOverlay: () => void
}

/**
 * Hook to manage screen dim overlay for kiosk mode
 * Shows black overlay and dims screen brightness when WebSocket disconnects
 * Waits 1 minute after disconnect before dimming
 * Restores brightness on reconnection or user touch
 */
export function useKioskScreenDim({
  kioskEnabled,
  wsStatus,
}: UseKioskScreenDimOptions): UseKioskScreenDimResult {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [dismissedByTouch, setDismissedByTouch] = useState(false)
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevWsStatusRef = useRef<WebSocketStatus>(wsStatus)

  // Clear the dim timer
  const clearDimTimer = useCallback(() => {
    if (dimTimerRef.current) {
      logger.debug('Clearing dim timer')
      clearTimeout(dimTimerRef.current)
      dimTimerRef.current = null
    }
  }, [])

  // Handle reconnection - restore brightness and hide overlay
  useEffect(() => {
    const wasDisconnected =
      prevWsStatusRef.current === 'disconnected' ||
      prevWsStatusRef.current === 'error'
    const isNowConnected = wsStatus === 'connected'

    // Update previous status
    prevWsStatusRef.current = wsStatus

    // On reconnection: always restore state
    if (wasDisconnected && isNowConnected) {
      logger.debug('WebSocket reconnected, restoring state')

      // Clear any pending timer
      clearDimTimer()

      // Always try to restore brightness on reconnection
      restoreBrightness().then((success) => {
        logger.debug(`Brightness restore: ${success ? 'success' : 'skipped'}`)
      })

      // Hide overlay
      setIsOverlayVisible(false)

      // Reset touch dismissal for next disconnect cycle
      setDismissedByTouch(false)
    }
  }, [wsStatus, clearDimTimer])

  // Handle disconnection - start dim timer
  useEffect(() => {
    // Only start timer if:
    // 1. Kiosk mode is enabled
    // 2. WebSocket is disconnected or error
    // 3. User hasn't dismissed via touch
    // 4. Overlay is not already visible
    // 5. Timer is not already running
    const shouldStartTimer =
      kioskEnabled &&
      (wsStatus === 'disconnected' || wsStatus === 'error') &&
      !dismissedByTouch &&
      !isOverlayVisible &&
      !dimTimerRef.current

    if (shouldStartTimer) {
      logger.debug(
        `WebSocket disconnected in kiosk mode, starting ${DIM_DELAY_MS / 1000}s dim timer`,
      )

      dimTimerRef.current = setTimeout(() => {
        logger.debug('Dim timer elapsed, showing overlay and dimming screen')
        setIsOverlayVisible(true)
        // Dim the screen brightness
        dimScreen().then((success) => {
          logger.debug(`Screen dim: ${success ? 'success' : 'failed'}`)
        })
        dimTimerRef.current = null
      }, DIM_DELAY_MS)
    }
  }, [kioskEnabled, wsStatus, dismissedByTouch, isOverlayVisible])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearDimTimer()
    }
  }, [clearDimTimer])

  const dismissOverlay = useCallback(() => {
    logger.debug('Overlay dismissed by user touch')
    setIsOverlayVisible(false)
    setDismissedByTouch(true)
    // Always try to restore brightness when user taps
    restoreBrightness().then((success) => {
      logger.debug(
        `Brightness restore on tap: ${success ? 'success' : 'skipped'}`,
      )
    })
  }, [])

  return {
    isOverlayVisible,
    dismissOverlay,
  }
}
