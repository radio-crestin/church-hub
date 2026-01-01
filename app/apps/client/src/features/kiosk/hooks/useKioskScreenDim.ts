import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { dimScreen, restoreBrightness } from '../service/brightnessService'

const logger = createLogger('kiosk:screen-dim')

/** Delay before dimming screen after WebSocket disconnect (in milliseconds) */
const DIM_DELAY_MS = 60 * 1000 // 1 minute

/** Number of disconnects after which to immediately blank the screen */
const MAX_DISCONNECTS_BEFORE_BLANK = 5

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseKioskScreenDimOptions {
  kioskEnabled: boolean
  wsStatus: WebSocketStatus
  disconnectCount: number
}

interface UseKioskScreenDimResult {
  isOverlayVisible: boolean
  dismissOverlay: () => void
}

/**
 * Hook to manage screen dim overlay for kiosk mode
 * Shows black overlay and dims screen brightness when WebSocket disconnects
 * Waits 1 minute after disconnect before dimming, or immediately after 5 disconnects
 * Restores brightness on reconnection or user touch
 */
export function useKioskScreenDim({
  kioskEnabled,
  wsStatus,
  disconnectCount,
}: UseKioskScreenDimOptions): UseKioskScreenDimResult {
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [dismissedByTouch, setDismissedByTouch] = useState(false)
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the dim timer
  const clearDimTimer = useCallback(() => {
    if (dimTimerRef.current) {
      logger.debug('Clearing dim timer')
      clearTimeout(dimTimerRef.current)
      dimTimerRef.current = null
    }
  }, [])

  // Handle reconnection - restore brightness and hide overlay
  // When connected and overlay is visible (or timer is pending), restore screen
  useEffect(() => {
    if (wsStatus !== 'connected') {
      return
    }

    // If overlay is visible, restore screen (same as tap to dismiss)
    if (isOverlayVisible) {
      logger.info(
        'WebSocket reconnected while screen blanked, restoring brightness and hiding overlay',
      )
      restoreBrightness().then((success) => {
        logger.info(`Brightness restore: ${success ? 'success' : 'skipped'}`)
      })
      setIsOverlayVisible(false)
      setDismissedByTouch(false)
    }

    // If timer is pending, clear it
    if (dimTimerRef.current) {
      logger.info('WebSocket reconnected, clearing pending dim timer')
      clearDimTimer()
      setDismissedByTouch(false)
    }
  }, [wsStatus, isOverlayVisible, clearDimTimer])

  // Handle disconnection - start dim timer or immediately dim after 5 disconnects
  useEffect(() => {
    const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error'

    // Skip if not in kiosk mode, not disconnected, or already visible
    if (!kioskEnabled || !isDisconnected || isOverlayVisible) {
      return
    }

    // After 5 disconnects, immediately blank the screen (regardless of touch dismissal)
    // Reconnection will continue and restore screen when successful
    if (disconnectCount >= MAX_DISCONNECTS_BEFORE_BLANK) {
      logger.info(
        `${disconnectCount} disconnects reached, immediately blanking screen (will restore on reconnect)`,
      )
      clearDimTimer()
      setIsOverlayVisible(true)
      dimScreen().then((success) => {
        logger.info(`Screen dim: ${success ? 'success' : 'failed'}`)
      })
      return
    }

    // Otherwise, start timer if not already running and not dismissed by touch
    const shouldStartTimer = !dismissedByTouch && !dimTimerRef.current

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
  }, [
    kioskEnabled,
    wsStatus,
    dismissedByTouch,
    isOverlayVisible,
    disconnectCount,
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
