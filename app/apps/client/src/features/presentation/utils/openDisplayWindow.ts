import { setWindowFullscreen } from './fullscreen'
import type { DisplayOpenMode, Screen } from '../types'

const WINDOW_POSITIONS_KEY = 'display-window-positions'

interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
  fullscreen: boolean
}

// Cached isTauri result to avoid repeated checks and logging
let isTauriCached: boolean | null = null

/**
 * Checks if we're running inside Tauri
 * In Tauri v2, checks for __TAURI_INTERNALS__ or __TAURI__
 * Result is cached after first check to prevent excessive logging and computation
 */
export function isTauri(): boolean {
  if (isTauriCached !== null) {
    return isTauriCached
  }
  const hasTauriInternals = '__TAURI_INTERNALS__' in window
  const hasTauri = '__TAURI__' in window
  isTauriCached = hasTauriInternals || hasTauri
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri detection (logged once)
  console.log(
    '[isTauri] __TAURI_INTERNALS__:',
    hasTauriInternals,
    '__TAURI__:',
    hasTauri,
    '(cached)',
  )
  return isTauriCached
}

/**
 * Gets the frontend base URL for display windows
 * In Tauri mode, window.location.origin returns tauri://localhost
 * so we need to use the actual server URL (localhost:3000)
 */
export function getFrontendUrl(): string {
  // In Tauri mode, use 127.0.0.1 (where sidecar serves the app)
  // Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues on macOS
  if (isTauri()) {
    const port = import.meta.env.VITE_SERVER_PORT ?? 3000
    return `http://127.0.0.1:${port}`
  }
  // In browser mode, use the current origin
  return window.location.origin
}

/**
 * Saves window state to localStorage
 */
function saveWindowState(displayId: number, state: WindowState): void {
  try {
    const states = getStoredStates()
    states[displayId] = state
    localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(states))
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[saveWindowState] Failed to save window state:', error)
  }
}

/**
 * Gets stored window states
 */
function getStoredStates(): Record<number, WindowState> {
  try {
    const stored = localStorage.getItem(WINDOW_POSITIONS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

/**
 * Gets stored state for a specific display
 */
function getStoredState(displayId: number): WindowState | null {
  const states = getStoredStates()
  return states[displayId] || null
}

/**
 * Opens a display window based on the configured mode.
 * Set `focus` to false to open without stealing focus from the control room
 * (used for auto-open on startup and auto-reopen after Escape).
 */
export async function openDisplayWindow(
  displayId: number,
  openMode: DisplayOpenMode,
  defaultFullscreen = false,
  screenName?: string,
  alwaysOnTop = false,
  focus = true,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(
    `[openDisplayWindow] Opening display ${displayId} in ${openMode} mode, isTauri: ${isTauri()}, defaultFullscreen: ${defaultFullscreen}, alwaysOnTop: ${alwaysOnTop}, focus: ${focus}`,
  )
  const displayUrl = `${getFrontendUrl()}/screen/${displayId}`
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(`[openDisplayWindow] URL: ${displayUrl}`)

  if (openMode === 'browser') {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openDisplayWindow] Opening in browser mode')
    await openInBrowser(displayUrl)
  } else {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openDisplayWindow] Opening in native mode')
    await openInNativeWindow(
      displayId,
      displayUrl,
      defaultFullscreen,
      screenName,
      alwaysOnTop,
      focus,
    )
  }
}

/**
 * Opens the display in the system's default browser
 */
export async function openInBrowser(url: string): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
  console.log(`[openInBrowser] called, isTauri: ${isTauri()}`)
  if (isTauri()) {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[openInBrowser] Importing @tauri-apps/plugin-shell')
      const { open } = await import('@tauri-apps/plugin-shell')
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[openInBrowser] Calling shell.open()')
      await open(url)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[openInBrowser] shell.open() completed')
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.error(
        '[openInBrowser] Failed to open in browser via Tauri:',
        error,
      )
      window.open(url, '_blank')
    }
  } else {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log('[openInBrowser] Opening via window.open')
    window.open(url, '_blank')
  }
}

/**
 * Opens the display in a native Tauri window
 */
async function openInNativeWindow(
  displayId: number,
  url: string,
  defaultFullscreen = false,
  screenName?: string,
  alwaysOnTop = false,
  focus = true,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(`[openInNativeWindow] called, isTauri: ${isTauri()}`)

  if (isTauri()) {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] Importing @tauri-apps/api/webviewWindow',
      )
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] WebviewWindow imported:', WebviewWindow)

      const windowLabel = `display-${displayId}`
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(`[openInNativeWindow] Window label: ${windowLabel}`)

      // Check if window already exists
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Checking for existing window')
      const existingWindow = await WebviewWindow.getByLabel(windowLabel)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] existingWindow:', existingWindow)
      if (existingWindow) {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
        console.log(`[openInNativeWindow] Window exists, focus=${focus}`)
        if (focus) {
          await existingWindow.setFocus()
        }
        await existingWindow.setAlwaysOnTop(alwaysOnTop)
        return
      }

      // Get stored state or use defaults
      const storedState = getStoredState(displayId)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Stored state:', storedState)

      const windowOptions = {
        url,
        title: screenName || `Display ${displayId}`,
        width: storedState?.width ?? 1280,
        height: storedState?.height ?? 720,
        x: storedState?.x,
        y: storedState?.y,
        center: !storedState,
        resizable: true,
        maximizable: true,
        minimizable: true,
        decorations: true,
        alwaysOnTop,
        skipTaskbar: true,
        focus,
        backgroundColor: '#000000',
      }
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] Creating window with options:',
        windowOptions,
      )

      // When focus=false, save the currently focused window so we can restore
      // focus after the new window is created (macOS / some WMs auto-focus
      // new windows regardless of the `focus: false` option).
      const mainWindowToRefocus = focus
        ? null
        : await (async () => {
            try {
              const { getCurrentWindow } = await import(
                '@tauri-apps/api/window'
              )
              return getCurrentWindow()
            } catch {
              return null
            }
          })()

      // Create new native window
      const webview = new WebviewWindow(windowLabel, windowOptions)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] WebviewWindow constructor called, webview:',
        webview,
      )

      // Set up event listeners
      webview.once('tauri://created', async () => {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
        console.log(
          `[openInNativeWindow] Native window created: ${windowLabel}`,
        )

        // Small delay to ensure window is fully ready
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Get the window by label to ensure we have the correct reference
        const win = await WebviewWindow.getByLabel(windowLabel)
        if (!win) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.error('[openInNativeWindow] Could not get window by label')
          return
        }

        // Restore fullscreen or maximized state if it was saved, or use default setting
        if (storedState?.fullscreen) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.log('[openInNativeWindow] Restoring fullscreen state')
          await setWindowFullscreen(win, true)
        } else if (storedState?.maximized) {
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.log('[openInNativeWindow] Restoring maximized state')
          await win.maximize()
        } else if (!storedState && defaultFullscreen) {
          // No stored state but default fullscreen is enabled
          // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
          console.log(
            '[openInNativeWindow] Applying default fullscreen setting',
          )
          await setWindowFullscreen(win, true)
        }

        // Set up state tracking
        const trackState = async () => {
          try {
            const win = await WebviewWindow.getByLabel(windowLabel)
            if (win) {
              const position = await win.outerPosition()
              const size = await win.outerSize()
              const isMaximized = await win.isMaximized()
              const isFullscreen = await win.isFullscreen()
              saveWindowState(displayId, {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                maximized: isMaximized,
                fullscreen: isFullscreen,
              })
            }
          } catch {
            // Window might be closed
          }
        }

        // Track state on move, resize, and other changes
        webview.listen('tauri://move', trackState)
        webview.listen('tauri://resize', trackState)

        // Keep keyboard focus on the control window so the operator can keep
        // navigating verses (keyboard / presenter remote) while the screen
        // shows — the projector window must not steal focus.
        //
        // BUT only when the screen has its own monitor. setFocus() also RAISES
        // the control window; on a single monitor that would cover the
        // projection and the song would seem to "not display". With one
        // monitor we leave the screen in front (visible) instead. With a
        // second monitor the projection is on the other screen, so refocusing
        // the control window is harmless and keyboard input keeps working.
        if (mainWindowToRefocus) {
          const isMultiMonitor = await (async () => {
            try {
              const { availableMonitors } = await import(
                '@tauri-apps/api/window'
              )
              return (await availableMonitors()).length > 1
            } catch {
              return false
            }
          })()

          if (isMultiMonitor) {
            const reclaimFocus = async () => {
              try {
                await mainWindowToRefocus.setFocus()
              } catch (error) {
                // biome-ignore lint/suspicious/noConsole: Tauri focus restoration
                console.warn(
                  '[openInNativeWindow] Failed to restore focus to main window:',
                  error,
                )
              }
            }
            await reclaimFocus()
            // The OS can hand focus back to the new window again once it
            // finishes appearing / the fullscreen transition animates
            // (≈1s on macOS), so re-assert a few more times across that window.
            for (const delay of [200, 500, 900]) {
              setTimeout(reclaimFocus, delay)
            }
          }
        }
      })

      webview.once('tauri://error', (e) => {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
        console.error('[openInNativeWindow] tauri://error event:', e)
      })

      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Event listeners attached')
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.error('[openInNativeWindow] Error opening native window:', error)
      // Fallback to browser
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Falling back to browser window.open')
      window.open(url, '_blank')
    }
  } else {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openInNativeWindow] Not in Tauri, falling back to browser')
    window.open(url, '_blank')
  }
}

/**
 * Closes a native display window
 */
export async function closeDisplayWindow(displayId: number): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
  console.log(
    `[closeDisplayWindow] Closing display ${displayId}, isTauri: ${isTauri()}`,
  )
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(`[closeDisplayWindow] Looking for window: ${windowLabel}`)
    const win = await WebviewWindow.getByLabel(windowLabel)
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(`[closeDisplayWindow] Window found: ${!!win}`)
    if (win) {
      await win.close()
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[closeDisplayWindow] Window closed successfully')
    } else {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.warn(`[closeDisplayWindow] Window not found: ${windowLabel}`)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[closeDisplayWindow] Failed to close display window:', error)
  }
}

/**
 * Toggles fullscreen mode for a native display window
 */
export async function toggleDisplayFullscreen(
  displayId: number,
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      const isFullscreen = await win.isFullscreen()
      await win.setFullscreen(!isFullscreen)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error(
      '[toggleDisplayFullscreen] Failed to toggle fullscreen:',
      error,
    )
  }
}

/**
 * Sets fullscreen mode for a native display window
 */
export async function setDisplayFullscreen(
  displayId: number,
  fullscreen: boolean,
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      await win.setFullscreen(fullscreen)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[setDisplayFullscreen] Failed to set fullscreen:', error)
  }
}

/**
 * Sets always-on-top mode for a native display window
 */
export async function setDisplayAlwaysOnTop(
  displayId: number,
  alwaysOnTop: boolean,
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      await win.setAlwaysOnTop(alwaysOnTop)
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error('[setDisplayAlwaysOnTop] Failed to set always on top:', error)
  }
}

/**
 * Opens the screens the operator wants up as soon as the app launches.
 *
 * `isActive` alone used to decide this, which meant the startup set was
 * whatever happened to be open last. `openOnStartup` makes it an explicit,
 * per-screen choice: turn it off and the window stays closed at launch, yet
 * `reopenMissingActiveScreens` still brings it up the moment something is
 * presented — after which it behaves like every other screen.
 */
export async function openAllActiveScreens(screens: Screen[]): Promise<void> {
  const activeScreens = screens.filter((s) => s.isActive && s.openOnStartup)

  for (const screen of activeScreens) {
    // Always use 'native' mode (matching ScreenManager behavior).
    // focus: false keeps the control room focused during startup.
    await openDisplayWindow(
      screen.id,
      'native',
      screen.isFullscreen,
      screen.name,
      screen.alwaysOnTop,
      false,
    )
    // Small delay to prevent overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * Reopens active screen windows that the user manually closed (e.g. clicked X).
 * `screen.isActive` stays true on manual close, so when presentation state
 * changes we re-check and respawn any missing windows.
 */
export async function reopenMissingActiveScreens(
  screens: Screen[],
): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const activeScreens = screens.filter((s) => s.isActive)

    for (const screen of activeScreens) {
      const windowLabel = `display-${screen.id}`
      const existing = await WebviewWindow.getByLabel(windowLabel)
      if (existing) continue

      // focus: false so the user keeps interacting with the control room
      // while a closed display window auto-reopens behind the scenes.
      await openDisplayWindow(
        screen.id,
        'native',
        screen.isFullscreen,
        screen.name,
        screen.alwaysOnTop,
        false,
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Error logging
    console.error(
      '[reopenMissingActiveScreens] Failed to reopen screen window(s):',
      error,
    )
  }
}

/**
 * Brings keyboard focus back to the control (main) window after presenting, so
 * the operator can keep advancing slides/verses from the keyboard without
 * clicking back into the app. macOS / some WMs hand focus to the projector
 * window when it appears or its content changes; this re-claims it.
 *
 * MULTI-MONITOR ONLY — on a single screen, raising the control window would
 * cover the projection (it shares the monitor with it), so we leave focus on
 * the projector there. On a second monitor the projection is elsewhere, so
 * refocusing control is invisible to the audience and keeps the keyboard live.
 * (Mirrors the same guard in `openInNativeWindow`.) A few re-asserts win the
 * focus race against a window that finishes appearing slightly later.
 */
export async function reclaimControlWindowFocus(): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow, availableMonitors } = await import(
      '@tauri-apps/api/window'
    )
    if ((await availableMonitors()).length <= 1) return

    const control = getCurrentWindow()
    const reclaim = async () => {
      try {
        await control.setFocus()
      } catch {
        // best-effort; the window may be mid-transition
      }
    }
    await reclaim()
    for (const delay of [200, 500]) {
      setTimeout(reclaim, delay)
    }
  } catch {
    // best-effort focus restoration; never throw into the presentation flow
  }
}
