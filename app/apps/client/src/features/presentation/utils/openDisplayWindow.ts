import { setWindowFullscreen } from './fullscreen'
import type { Display, DisplayOpenMode } from '../types'

const WINDOW_POSITIONS_KEY = 'display-window-positions'

interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
  fullscreen: boolean
}

/**
 * Checks if we're running inside Tauri
 * In Tauri v2, checks for __TAURI_INTERNALS__ or __TAURI__
 */
export function isTauri(): boolean {
  const hasTauriInternals = '__TAURI_INTERNALS__' in window
  const hasTauri = '__TAURI__' in window
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri detection
  console.log(
    '[isTauri] __TAURI_INTERNALS__:',
    hasTauriInternals,
    '__TAURI__:',
    hasTauri,
  )
  return hasTauriInternals || hasTauri
}

/**
 * Gets the frontend base URL for display windows
 * Uses the same origin the client accessed from
 */
function getFrontendUrl(): string {
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
 * Opens a display window based on the configured mode
 */
export async function openDisplayWindow(
  displayId: number,
  openMode: DisplayOpenMode,
  defaultFullscreen = false,
): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(
    `[openDisplayWindow] Opening display ${displayId} in ${openMode} mode, isTauri: ${isTauri()}, defaultFullscreen: ${defaultFullscreen}`,
  )
  const displayUrl = `${getFrontendUrl()}/display/${displayId}`
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
  console.log(`[openDisplayWindow] URL: ${displayUrl}`)

  if (openMode === 'browser') {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openDisplayWindow] Opening in browser mode')
    await openInBrowser(displayUrl)
  } else {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
    console.log('[openDisplayWindow] Opening in native mode')
    await openInNativeWindow(displayId, displayUrl, defaultFullscreen)
  }
}

/**
 * Opens the display in the system's default browser
 */
async function openInBrowser(url: string): Promise<void> {
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
        console.log('[openInNativeWindow] Window exists, focusing')
        await existingWindow.setFocus()
        await existingWindow.setAlwaysOnTop(true)
        return
      }

      // Get stored state or use defaults
      const storedState = getStoredState(displayId)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log('[openInNativeWindow] Stored state:', storedState)

      const windowOptions = {
        url,
        title: `Display ${displayId}`,
        width: storedState?.width ?? 1280,
        height: storedState?.height ?? 720,
        x: storedState?.x,
        y: storedState?.y,
        center: !storedState,
        resizable: true,
        maximizable: true,
        minimizable: true,
        decorations: true,
        alwaysOnTop: true,
        focus: true,
      }
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri window creation
      console.log(
        '[openInNativeWindow] Creating window with options:',
        windowOptions,
      )

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
 * Opens all active displays with native windows
 */
export async function openAllActiveDisplays(
  displays: Display[],
): Promise<void> {
  const activeNativeDisplays = displays.filter(
    (d) => d.isActive && d.openMode === 'native',
  )

  for (const display of activeNativeDisplays) {
    await openDisplayWindow(display.id, display.openMode, display.isFullscreen)
    // Small delay to prevent overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * Closes a native display window
 */
export async function closeDisplayWindow(displayId: number): Promise<void> {
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `display-${displayId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      await win.close()
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
