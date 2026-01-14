import { useNavigate } from '@tanstack/react-router'
import { Maximize, Minimize } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { isMobile } from '~/config'
import { createLogger } from '~/utils/logger'
import { ScreenContent } from './ScreenContent'
import { ScreenShareReceiver } from './ScreenShareReceiver'
import { getBackgroundCSS } from './utils'
import { getNextVerse } from '../../../bible/service/bible'
import { useKioskSettings } from '../../../kiosk'
import { useUpsertScreen, useWebSocket } from '../../hooks'
import { usePresentationContent } from '../../hooks/usePresentationContent'
import { useScreen } from '../../hooks/useScreen'
import { useSlideHighlights } from '../../hooks/useSlideHighlights'
import type { ScreenShareContentConfig } from '../../types'
import { setWindowFullscreen } from '../../utils/fullscreen'
import { isTauri } from '../../utils/openDisplayWindow'

const logger = createLogger('ScreenRenderer')

// Number of missed pings before hiding content on disconnection
const DISCONNECT_HIDE_THRESHOLD = 5

interface ScreenRendererProps {
  screenId: number
}

export function ScreenRenderer({ screenId }: ScreenRendererProps) {
  const { debugInfo: wsDebugInfo, send: wsSend } = useWebSocket()
  const navigate = useNavigate()

  const { data: screen, isLoading, isError } = useScreen(screenId)
  const upsertScreen = useUpsertScreen()
  const { data: kioskSettings } = useKioskSettings()
  const { data: slideHighlights } = useSlideHighlights()

  // Use shared presentation content hook
  const {
    contentType,
    contentData,
    isVisible: hookIsVisible,
    isExitAnimating,
    nextSlideData,
    presentationState,
  } = usePresentationContent({
    screen,
    includeNextSlide: screen?.nextSlideConfig?.enabled ?? false,
    getNextVerse: async (verseId: number) => {
      const result = await getNextVerse(verseId)
      return result
    },
  })

  // Determine if current screen is being viewed in kiosk mode context
  const isKioskModeScreen =
    kioskSettings?.enabled === true &&
    kioskSettings?.startupPage?.type === 'screen' &&
    kioskSettings?.startupPage?.screenId === screenId

  const containerRef = useRef<HTMLDivElement>(null)

  // Fullscreen state and toolbar visibility
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)
  const toolbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userExitedFullscreenRef = useRef(false)

  // Track if we're in a native display window (fullscreen only allowed there)
  const [isNativeDisplayWindow, setIsNativeDisplayWindow] = useState(false)

  // Track container dimensions (start at 0, render only when measured)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Use ResizeObserver to measure the wrapper element (NOT window size)
  // Re-run when screen loads to attach observer to the actual container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [screen])

  // Detect if we're in a native display window (only those can go fullscreen)
  useEffect(() => {
    const detectDisplayWindow = async () => {
      if (!isTauri()) {
        // In browser mode, check if URL contains /display/ route
        setIsNativeDisplayWindow(window.location.pathname.includes('/display/'))
        return
      }

      try {
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()
        // Native display windows have labels like "display-{id}"
        const isDisplayWindow = win.label.startsWith('display-')
        setIsNativeDisplayWindow(isDisplayWindow)
      } catch {
        setIsNativeDisplayWindow(false)
      }
    }

    detectDisplayWindow()
  }, [])

  // Track fullscreen state and auto-switch to fullscreen on maximize
  useEffect(() => {
    let unlistenResize: (() => void) | null = null

    const setupTauriListeners = async () => {
      if (!isTauri()) return

      try {
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()

        // Only apply fullscreen logic to native display windows
        const isDisplayWindow = win.label.startsWith('display-')

        // Check initial fullscreen state
        const fs = await win.isFullscreen()
        setIsFullscreen(fs)

        // Listen for resize events to detect maximize
        unlistenResize = await win.listen('tauri://resize', async () => {
          const isMaximized = await win.isMaximized()
          const isFs = await win.isFullscreen()

          // If window is maximized but not fullscreen, switch to fullscreen
          // But only if user didn't just exit fullscreen manually
          // And only for native display windows
          if (
            isDisplayWindow &&
            isMaximized &&
            !isFs &&
            !userExitedFullscreenRef.current
          ) {
            await setWindowFullscreen(win, true)
            setIsFullscreen(true)

            // Save to database
            if (screen) {
              upsertScreen.mutate({
                id: screen.id,
                name: screen.name,
                type: screen.type,
                isFullscreen: true,
              })
            }
          }

          // Reset the flag after a short delay to allow re-maximizing later
          if (!isMaximized && userExitedFullscreenRef.current) {
            setTimeout(() => {
              userExitedFullscreenRef.current = false
            }, 500)
          }

          setIsFullscreen(await win.isFullscreen())
        })
      } catch (_error) {}
    }

    const checkFullscreen = () => {
      if (!isTauri()) {
        // Cross-browser fullscreen element check
        const fullscreenElement =
          document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element })
            .webkitFullscreenElement ||
          (document as unknown as { msFullscreenElement?: Element })
            .msFullscreenElement
        setIsFullscreen(!!fullscreenElement)
      }
    }

    setupTauriListeners()

    // Listen for fullscreen changes in browser (cross-browser support)
    document.addEventListener('fullscreenchange', checkFullscreen)
    document.addEventListener('webkitfullscreenchange', checkFullscreen)
    document.addEventListener('MSFullscreenChange', checkFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen)
      document.removeEventListener('webkitfullscreenchange', checkFullscreen)
      document.removeEventListener('MSFullscreenChange', checkFullscreen)
      if (unlistenResize) {
        unlistenResize()
      }
    }
  }, [screen, upsertScreen])

  // Helper function for browser fullscreen (cross-browser support)
  const useBrowserFullscreen = async (
    enterFullscreen: boolean,
  ): Promise<boolean> => {
    try {
      if (enterFullscreen) {
        const elem = document.documentElement
        if (elem.requestFullscreen) {
          await elem.requestFullscreen()
        } else if (
          (elem as unknown as { webkitRequestFullscreen?: () => Promise<void> })
            .webkitRequestFullscreen
        ) {
          await (
            elem as unknown as { webkitRequestFullscreen: () => Promise<void> }
          ).webkitRequestFullscreen()
        } else if (
          (elem as unknown as { msRequestFullscreen?: () => Promise<void> })
            .msRequestFullscreen
        ) {
          await (
            elem as unknown as { msRequestFullscreen: () => Promise<void> }
          ).msRequestFullscreen()
        }
      } else {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen()
          } else if (
            (
              document as unknown as {
                webkitExitFullscreen?: () => Promise<void>
              }
            ).webkitExitFullscreen
          ) {
            await (
              document as unknown as {
                webkitExitFullscreen: () => Promise<void>
              }
            ).webkitExitFullscreen()
          } else if (
            (document as unknown as { msExitFullscreen?: () => Promise<void> })
              .msExitFullscreen
          ) {
            await (
              document as unknown as { msExitFullscreen: () => Promise<void> }
            ).msExitFullscreen()
          }
        }
      }
      return true
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for fullscreen
      console.error('[useBrowserFullscreen] Error:', error)
      return false
    }
  }

  // Toggle fullscreen and save to database (only in native display windows)
  const toggleFullscreen = useCallback(async () => {
    // Only allow fullscreen in native display windows, not in main window
    if (!isNativeDisplayWindow) {
      return
    }

    const newFullscreen = !isFullscreen
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(`[toggleFullscreen] Toggling fullscreen to: ${newFullscreen}`)

    // If exiting fullscreen, set flag to prevent auto-fullscreen on resize
    if (!newFullscreen) {
      userExitedFullscreenRef.current = true
    }

    let success = false

    if (isTauri()) {
      try {
        const { getCurrentWebviewWindow } = await import(
          '@tauri-apps/api/webviewWindow'
        )
        const win = getCurrentWebviewWindow()
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.log('[toggleFullscreen] Got window:', win?.label)

        // setWindowFullscreen now returns boolean indicating success
        const tauriSuccess = await setWindowFullscreen(win, newFullscreen)

        if (tauriSuccess) {
          setIsFullscreen(newFullscreen)
          success = true
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
          console.log('[toggleFullscreen] Tauri fullscreen set successfully')
        } else {
          // Tauri methods failed, try browser fullscreen as fallback
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
          console.log(
            '[toggleFullscreen] Tauri methods failed, trying browser fullscreen fallback...',
          )
          success = await useBrowserFullscreen(newFullscreen)
          if (success) {
            setIsFullscreen(newFullscreen)
            // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
            console.log(
              '[toggleFullscreen] Browser fullscreen fallback succeeded',
            )
          }
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.error(
          '[toggleFullscreen] Tauri fullscreen threw error, trying browser fallback:',
          error,
        )
        // Fallback to browser fullscreen API when Tauri fails
        success = await useBrowserFullscreen(newFullscreen)
        if (success) {
          setIsFullscreen(newFullscreen)
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
          console.log(
            '[toggleFullscreen] Browser fullscreen fallback succeeded after error',
          )
        }
      }
    } else {
      // Not in Tauri, use browser fullscreen directly
      success = await useBrowserFullscreen(newFullscreen)
      if (success) {
        setIsFullscreen(newFullscreen)
      }
    }

    if (!success) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for fullscreen
      console.error('[toggleFullscreen] All fullscreen methods failed')
    }

    // Save fullscreen state to database
    if (screen) {
      upsertScreen.mutate({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        isFullscreen: newFullscreen,
      })
    }
  }, [isFullscreen, isNativeDisplayWindow, screen, upsertScreen])

  // Show toolbar on mouse move near the top
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const threshold = 60 // pixels from top
    if (e.clientY < threshold) {
      setShowToolbar(true)
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current)
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false)
      }, 3000)
    }
  }, [])

  // Show toolbar on touch near the top
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Use larger threshold for mobile to account for iOS safe area insets
    const threshold = isMobile() ? 120 : 60
    const touch = e.touches[0]
    if (touch && touch.clientY < threshold) {
      setShowToolbar(true)
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current)
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false)
      }, 3000)
    }
  }, [])

  // Show toolbar on click near the top
  const handleClick = useCallback((e: React.MouseEvent) => {
    const threshold = isMobile() ? 120 : 60
    if (e.clientY < threshold) {
      setShowToolbar(true)
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current)
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false)
      }, 3000)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current)
      }
    }
  }, [])

  // Make html and body transparent for screen display (allows user-configured backgrounds)
  // In kiosk mode with a screen, lock dimensions to screen size and disable scrolling
  useEffect(() => {
    const html = document.documentElement
    const body = document.body

    // Store original styles
    const originalHtmlBg = html.style.backgroundColor
    const originalBodyBg = body.style.backgroundColor
    const originalHtmlOverflow = html.style.overflow
    const originalBodyOverflow = body.style.overflow

    // Set transparent background
    html.style.backgroundColor = 'transparent'
    body.style.backgroundColor = 'transparent'

    // In kiosk mode with a screen, disable scrolling but let screen fill available space
    if (isKioskModeScreen && screen) {
      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
    }

    return () => {
      html.style.backgroundColor = originalHtmlBg
      body.style.backgroundColor = originalBodyBg
      html.style.overflow = originalHtmlOverflow
      body.style.overflow = originalBodyOverflow
    }
  }, [isKioskModeScreen, screen])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFullscreen])

  // Clock tick for real-time updates (must be before any early returns)
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Keep transparent background while loading or on error
  if (isError || isLoading || !screen) {
    return (
      <div
        className="w-screen h-screen"
        style={{ backgroundColor: 'transparent' }}
      />
    )
  }

  const hasContent = Object.keys(contentData).length > 0

  // Check if we should hide content due to disconnection (5+ missed pings)
  const isDisconnectedAndHidden =
    wsDebugInfo.missedPongs >= DISCONNECT_HIDE_THRESHOLD

  // Visibility is false when hidden, during exit animation, or disconnected with too many missed pings
  // During exit animation, content is still rendered but animating out
  // After animation completes, contentData becomes empty
  const isVisible = hookIsVisible && !isDisconnectedAndHidden

  // Log visibility state changes for debugging
  logger.debug(
    `Render state: isVisible=${isVisible}, hasContent=${hasContent}, isHidden=${presentationState?.isHidden}, isExitAnimating=${isExitAnimating}, contentType=${contentType}, updatedAt=${presentationState?.updatedAt}`,
  )

  // Get background from screen config for fullscreen display
  // When disconnected and hidden, use empty state background
  const effectiveContentType = isDisconnectedAndHidden ? 'empty' : contentType
  const config = screen.contentConfigs[effectiveContentType]
  const bg = config?.background || screen.contentConfigs.empty?.background

  // Get styleRanges from useSlideHighlights hook for real-time WebSocket updates
  const styleRanges = slideHighlights ?? []

  // On mobile, use safe area wrapper to avoid content going behind status bar
  const isMobileDevice = isMobile()

  return (
    <div
      className="w-screen h-screen overflow-hidden cursor-default"
      style={bg ? getBackgroundCSS(bg) : { backgroundColor: '#000000' }}
      onDoubleClick={isNativeDisplayWindow ? toggleFullscreen : undefined}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    >
      {/* Safe area wrapper - adds padding on mobile to avoid status bar */}
      <div
        className={
          isMobileDevice
            ? 'w-full h-full safe-area-inset box-border flex flex-col'
            : 'w-full h-full'
        }
      >
        {/* Floating toolbar */}
        <div
          className={`fixed z-50 p-2 transition-opacity duration-300 safe-area-top safe-area-right ${
            showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ top: 0, right: 0 }}
          onMouseEnter={() => {
            if (toolbarTimeoutRef.current) {
              clearTimeout(toolbarTimeoutRef.current)
            }
            setShowToolbar(true)
          }}
          onMouseLeave={() => {
            toolbarTimeoutRef.current = setTimeout(() => {
              setShowToolbar(false)
            }, 1000)
          }}
        >
          <div className="flex gap-2">
            {/* For kiosk screens (by type or kiosk mode), show exit button */}
            {screen?.type === 'kiosk' || isKioskModeScreen ? (
              <button
                type="button"
                onClick={() => navigate({ to: '/settings' })}
                className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                title="Exit Kiosk"
              >
                <Minimize size={20} />
              </button>
            ) : (
              // Only show fullscreen button in native display windows
              isNativeDisplayWindow && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize size={20} />
                  ) : (
                    <Maximize size={20} />
                  )}
                </button>
              )
            )}
          </div>
        </div>

        {/* Content container - measured for actual available space */}
        <div
          ref={containerRef}
          className={isMobileDevice ? 'flex-1 relative' : 'w-full h-full'}
        >
          {containerSize.width > 0 && containerSize.height > 0 && (
            <>
              {contentType === 'screen_share' &&
              presentationState?.temporaryContent?.type === 'screen_share' ? (
                <ScreenShareReceiver
                  broadcasterId={
                    presentationState.temporaryContent.data.broadcasterId
                  }
                  audioEnabled={
                    screen.globalSettings.screenShareAudioEnabled ?? false
                  }
                  send={wsSend}
                  videoElement={
                    (
                      screen.contentConfigs
                        .screen_share as ScreenShareContentConfig
                    )?.videoElement
                  }
                />
              ) : (
                <ScreenContent
                  screen={screen}
                  contentType={contentType}
                  contentData={contentData}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                  isVisible={isVisible}
                  nextSlideData={nextSlideData}
                  styleRanges={styleRanges}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
