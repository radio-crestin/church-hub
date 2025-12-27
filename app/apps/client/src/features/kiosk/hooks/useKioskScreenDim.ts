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
  const hasDimmedRef = useRef(false)
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the dim timer
  const clearDimTimer = useCallback(() => {
    if (dimTimerRef.current) {
      logger.debug('Clearing dim timer')
      clearTimeout(dimTimerRef.current)
      dimTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    // When connected, hide overlay, cancel timer, and reset touch dismissal
    if (wsStatus === 'connected') {
      clearDimTimer()

      if (isOverlayVisible) {
        logger.debug('WebSocket reconnected, hiding overlay')
        setIsOverlayVisible(false)
      }
      // Restore brightness when reconnected
      if (hasDimmedRef.current) {
        restoreBrightness()
        hasDimmedRef.current = false
      }
      // Reset touch dismissal on reconnect to allow overlay on next disconnect
      if (dismissedByTouch) {
        logger.debug('Resetting touch dismissal state')
        setDismissedByTouch(false)
      }
      return
    }

    // Start dim timer only if:
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
          if (success) {
            hasDimmedRef.current = true
          }
        })
        dimTimerRef.current = null
      }, DIM_DELAY_MS)
    }

    // Cleanup timer on unmount or dependency change
    return () => {
      // Only clear if we're about to start a new effect cycle
      // Don't clear on unmount if overlay is visible (let it stay)
    }
  }, [
    kioskEnabled,
    wsStatus,
    dismissedByTouch,
    isOverlayVisible,
    clearDimTimer,
  ])

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
    // Restore brightness when user taps
    if (hasDimmedRef.current) {
      restoreBrightness()
      hasDimmedRef.current = false
    }
  }, [])

  return {
    isOverlayVisible,
    dismissOverlay,
  }
}
