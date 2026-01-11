import { isTauri } from '~/utils/isTauri'
import { createLogger } from '~/utils/logger'
import { generateWindowIcon } from '../utils/generateWindowIcon'

const logger = createLogger('app:pageWindow')

const WINDOW_POSITIONS_KEY = 'sidebar-page-window-positions'

// Modern Chrome user agent for compatibility with sites like YouTube and WhatsApp Web
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'

interface PageWindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

type PageWindowStates = Record<string, PageWindowState>

/**
 * Gets the frontend base URL for page windows
 */
function getFrontendUrl(): string {
  if (isTauri()) {
    return 'http://localhost:3000'
  }
  return window.location.origin
}

/**
 * Saves window state to localStorage
 */
function savePageWindowState(pageId: string, state: PageWindowState): void {
  try {
    const states = getStoredStates()
    states[pageId] = state
    localStorage.setItem(WINDOW_POSITIONS_KEY, JSON.stringify(states))
  } catch (error) {
    logger.error('Failed to save window state:', error)
  }
}

/**
 * Gets stored window states
 */
function getStoredStates(): PageWindowStates {
  try {
    const stored = localStorage.getItem(WINDOW_POSITIONS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

/**
 * Gets stored state for a specific page
 */
export function getPageWindowState(pageId: string): PageWindowState | null {
  const states = getStoredStates()
  return states[pageId] || null
}

/**
 * Opens a sidebar page in a new browser tab
 */
export function openInBrowserTab(route: string): void {
  const url = `${getFrontendUrl()}${route}`
  window.open(url, '_blank')
}

/**
 * Opens a sidebar page in a native Tauri window
 * For custom pages with external URLs, loads the URL directly with proper user agent
 * For built-in pages, loads the app route
 *
 * @param pageId - Unique identifier for the page
 * @param pageLabel - Display title for the window
 * @param pageRoute - App route (e.g., /bible, /custom-page/123)
 * @param iconName - Optional Lucide icon name for window icon
 * @param externalUrl - Optional external URL for custom pages (e.g., https://web.whatsapp.com)
 */
export async function openPageInNativeWindow(
  pageId: string,
  pageLabel: string,
  pageRoute: string,
  iconName?: string,
  externalUrl?: string,
): Promise<void> {
  logger.debug(`Opening page ${pageId} (${pageLabel}) at ${pageRoute}`, {
    externalUrl,
  })

  if (!isTauri()) {
    logger.debug('Not in Tauri, opening in browser tab')
    // For external URLs in browser, open them directly
    if (externalUrl) {
      window.open(externalUrl, '_blank')
    } else {
      openInBrowserTab(pageRoute)
    }
    return
  }

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

    const windowLabel = `page-${pageId}`
    // For custom pages with external URLs, load the external URL directly
    // For app routes, add standalone=true to hide the sidebar
    const url = externalUrl
      ? externalUrl
      : `${getFrontendUrl()}${pageRoute}${pageRoute.includes('?') ? '&' : '?'}standalone=true`

    // Check if window already exists
    const existingWindow = await WebviewWindow.getByLabel(windowLabel)
    if (existingWindow) {
      logger.debug('Window exists, focusing and bringing to front')
      // Unminimize if minimized
      const isMinimized = await existingWindow.isMinimized()
      if (isMinimized) {
        await existingWindow.unminimize()
      }
      // Bring to front and focus
      await existingWindow.setFocus()
      return
    }

    // Get stored state or use defaults
    const storedState = getPageWindowState(pageId)

    // Build window options
    const windowOptions: Record<string, unknown> = {
      url,
      title: pageLabel,
      width: storedState?.width ?? 1200,
      height: storedState?.height ?? 800,
      x: storedState?.x,
      y: storedState?.y,
      center: !storedState,
      resizable: true,
      maximizable: true,
      minimizable: true,
      decorations: true,
      skipTaskbar: false, // Show in taskbar/dock
      focus: true,
    }

    // For external URLs, set Chrome user agent for compatibility
    if (externalUrl) {
      windowOptions.userAgent = CHROME_USER_AGENT
    }

    logger.debug('Creating window with options:', windowOptions)

    // Create new native window
    const webview = new WebviewWindow(windowLabel, windowOptions)

    // Set up event listeners
    webview.once('tauri://created', async () => {
      logger.debug(`Window created: ${windowLabel}`)

      // Small delay to ensure window is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Get the window by label to ensure we have the correct reference
      const win = await WebviewWindow.getByLabel(windowLabel)
      if (!win) {
        logger.error('Could not get window by label')
        return
      }

      // Restore maximized state if it was saved
      if (storedState?.maximized) {
        logger.debug('Restoring maximized state')
        await win.maximize()
      }

      // Set custom icon if available
      if (iconName) {
        try {
          const iconData = await generateWindowIcon(iconName)
          if (iconData) {
            await win.setIcon(iconData)
            logger.debug('Custom icon set')
          }
        } catch (iconError) {
          logger.warn('Failed to set custom icon:', iconError)
        }
      }

      // Set up state tracking
      const trackState = async () => {
        try {
          const win = await WebviewWindow.getByLabel(windowLabel)
          if (win) {
            const position = await win.outerPosition()
            const size = await win.outerSize()
            const isMaximized = await win.isMaximized()
            savePageWindowState(pageId, {
              x: position.x,
              y: position.y,
              width: size.width,
              height: size.height,
              maximized: isMaximized,
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
      logger.error('tauri://error event:', e)
    })
  } catch (error) {
    logger.error('Error opening native window:', error)
    // Fallback to browser
    openInBrowserTab(pageRoute)
  }
}

/**
 * Closes a native page window
 */
export async function closePageWindow(pageId: string): Promise<void> {
  logger.debug(`Closing page ${pageId}`)
  if (!isTauri()) return

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `page-${pageId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      await win.close()
      logger.debug('Window closed successfully')
    }
  } catch (error) {
    logger.error('Failed to close page window:', error)
  }
}

/**
 * Checks if a page window is currently open
 */
export async function isPageWindowOpen(pageId: string): Promise<boolean> {
  if (!isTauri()) return false

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `page-${pageId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    return win !== null
  } catch {
    return false
  }
}

/**
 * Focuses an existing page window, unminimizing if necessary
 */
export async function focusPageWindow(pageId: string): Promise<boolean> {
  if (!isTauri()) return false

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const windowLabel = `page-${pageId}`
    const win = await WebviewWindow.getByLabel(windowLabel)
    if (win) {
      // Unminimize if minimized
      const isMinimized = await win.isMinimized()
      if (isMinimized) {
        await win.unminimize()
      }
      // Bring to front and focus
      await win.setFocus()
      return true
    }
    return false
  } catch {
    return false
  }
}
