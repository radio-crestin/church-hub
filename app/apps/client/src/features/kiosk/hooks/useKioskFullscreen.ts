import { useEffect, useRef } from 'react'

import { isMobile } from '~/config'
import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { createLogger } from '~/utils/logger'

const logger = createLogger('kiosk:fullscreen')

interface UseKioskFullscreenOptions {
  enabled: boolean
}

/**
 * Hook to manage fullscreen mode for kiosk
 * - On iOS Tauri: app is already fullscreen by default
 * - On desktop Tauri: uses Tauri window API
 * - On browser: uses Web Fullscreen API
 */
export function useKioskFullscreen({ enabled }: UseKioskFullscreenOptions) {
  const hasRequestedFullscreen = useRef(false)

  useEffect(() => {
    if (!enabled) {
      hasRequestedFullscreen.current = false
      return
    }

    // On iOS Tauri, the app is already fullscreen in the native container
    // No additional action needed
    if (isTauri() && isMobile()) {
      logger.debug('iOS Tauri detected - app is already fullscreen')
      return
    }

    // On desktop Tauri, we don't force fullscreen for the main window
    // Fullscreen is handled per-display-window in ScreenRenderer
    if (isTauri()) {
      logger.debug(
        'Desktop Tauri detected - fullscreen handled by display windows',
      )
      return
    }

    // In browser mode, request fullscreen when kiosk is enabled
    // This only works with a user gesture, so it may not work automatically
    const requestBrowserFullscreen = async () => {
      if (hasRequestedFullscreen.current) return

      // Check if already in fullscreen
      const fullscreenElement =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element })
          .webkitFullscreenElement

      if (fullscreenElement) {
        logger.debug('Already in fullscreen mode')
        return
      }

      try {
        const elem = document.documentElement

        if (elem.requestFullscreen) {
          await elem.requestFullscreen()
          hasRequestedFullscreen.current = true
          logger.debug('Browser fullscreen requested via requestFullscreen')
        } else if (
          (elem as unknown as { webkitRequestFullscreen?: () => Promise<void> })
            .webkitRequestFullscreen
        ) {
          await (
            elem as unknown as { webkitRequestFullscreen: () => Promise<void> }
          ).webkitRequestFullscreen()
          hasRequestedFullscreen.current = true
          logger.debug(
            'Browser fullscreen requested via webkitRequestFullscreen',
          )
        }
      } catch (error) {
        // Fullscreen requires user gesture - this is expected to fail on auto-trigger
        logger.debug(
          'Fullscreen request failed (may require user gesture):',
          error,
        )
      }
    }

    requestBrowserFullscreen()
  }, [enabled])
}
