import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { dimScreen, restoreBrightness } from '../service/brightnessService'

const logger = createLogger('kiosk:screen-dim')

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
 * Restores brightness on reconnection or user touch
 */
export function useKioskScreenDim({
  kioskEnabled,
  wsStatus,
}: UseKioskScreenDimOptions): UseKioskScreenDimResult {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [dismissedByTouch, setDismissedByTouch] = useState(false)
  const hasDimmedRef = useRef(false)

  useEffect(() => {
    // When connected, hide overlay and reset touch dismissal
    if (wsStatus === 'connected') {
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

    // Show overlay only if:
    // 1. Kiosk mode is enabled
    // 2. WebSocket is disconnected or error
    // 3. User hasn't dismissed via touch
    const shouldShowOverlay =
      kioskEnabled &&
      (wsStatus === 'disconnected' || wsStatus === 'error') &&
      !dismissedByTouch

    if (shouldShowOverlay && !isOverlayVisible) {
      logger.debug('WebSocket disconnected in kiosk mode, showing overlay')
      setIsOverlayVisible(true)
      // Dim the screen brightness
      dimScreen().then((success) => {
        if (success) {
          hasDimmedRef.current = true
        }
      })
    }
  }, [kioskEnabled, wsStatus, dismissedByTouch, isOverlayVisible])

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
