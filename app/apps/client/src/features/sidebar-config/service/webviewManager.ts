import { isTauri } from '~/features/presentation/utils/openDisplayWindow'

import { transformToEmbedUrl } from '../utils/transformEmbedUrl'

/**
 * Global webview manager for custom pages
 * Uses Tauri v2 child Webview API to create webviews embedded in the main window
 */

// Track created child webviews by label
// Using 'any' because we can't import Webview type at module level
const createdWebviews = new Map<string, { close: () => Promise<void> }>()

// Currently visible webview label
let currentVisibleWebview: string | null = null

// Window resize listener cleanup
let resizeCleanup: (() => void) | null = null

// Chrome user agent for compatibility
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Gets the webview label for a custom page
 */
export function getWebviewLabel(pageId: string): string {
  return `custom-page-${pageId}`
}

/**
 * Calculates the content area bounds (right of sidebar)
 * For child webviews, we use coordinates relative to the window content area
 */
async function getContentAreaBounds(): Promise<{
  x: number
  y: number
  width: number
  height: number
}> {
  // Get the sidebar element to calculate its width
  const sidebar = document.querySelector('aside')
  const sidebarWidth = sidebar?.getBoundingClientRect().width ?? 256

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const mainWindow = getCurrentWindow()
    const size = await mainWindow.innerSize()
    const scaleFactor = await mainWindow.scaleFactor()

    // Convert physical pixels to logical pixels
    const windowWidth = size.width / scaleFactor
    const windowHeight = size.height / scaleFactor

    // For child webviews, coordinates are relative to the window content
    // No need to account for window position or title bar
    const bounds = {
      x: sidebarWidth,
      y: 0,
      width: windowWidth - sidebarWidth,
      height: windowHeight,
    }

    console.log('[webviewManager] Content area bounds:', bounds)
    return bounds
  } catch (error) {
    console.warn('[webviewManager] Could not get window info:', error)
    return {
      x: sidebarWidth,
      y: 0,
      width: window.innerWidth - sidebarWidth,
      height: window.innerHeight,
    }
  }
}

/**
 * Updates the current webview position on window resize
 */
async function handleWindowResize(): Promise<void> {
  if (!currentVisibleWebview) return

  try {
    const { Webview } = await import('@tauri-apps/api/webview')
    const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi')

    const webview = await Webview.getByLabel(currentVisibleWebview)
    if (!webview) return

    const bounds = await getContentAreaBounds()
    await webview.setPosition(new LogicalPosition(bounds.x, bounds.y))
    await webview.setSize(new LogicalSize(bounds.width, bounds.height))

    console.log('[webviewManager] Updated webview position on resize:', bounds)
  } catch (error) {
    console.error('[webviewManager] Error updating webview on resize:', error)
  }
}

/**
 * Sets up window resize listener
 */
function setupResizeListener(): void {
  if (resizeCleanup) return // Already set up

  let resizeTimeout: ReturnType<typeof setTimeout> | null = null

  const handleResize = () => {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(handleWindowResize, 100)
  }

  window.addEventListener('resize', handleResize)
  resizeCleanup = () => {
    window.removeEventListener('resize', handleResize)
    if (resizeTimeout) clearTimeout(resizeTimeout)
  }
}

/**
 * Creates or shows a child webview for a custom page
 * Uses Tauri's Webview API to create webviews embedded in the main window
 */
export async function showCustomPageWebview(
  pageId: string,
  url: string,
): Promise<void> {
  if (!isTauri()) return

  const label = getWebviewLabel(pageId)
  const embedUrl = transformToEmbedUrl(url)

  try {
    const { Webview } = await import('@tauri-apps/api/webview')
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi')

    // Close any currently visible webview first
    // Note: Child webviews don't support hide(), so we must close them
    if (currentVisibleWebview && currentVisibleWebview !== label) {
      console.log('[webviewManager] Closing previous webview:', currentVisibleWebview)
      await closeWebviewByLabel(currentVisibleWebview)
    }

    // Calculate content area bounds
    const bounds = await getContentAreaBounds()

    // Check if webview already exists
    const existingWebview = await Webview.getByLabel(label)
    if (existingWebview) {
      console.log('[webviewManager] Showing existing webview:', label)
      await existingWebview.setPosition(new LogicalPosition(bounds.x, bounds.y))
      await existingWebview.setSize(new LogicalSize(bounds.width, bounds.height))
      await existingWebview.show()
      await existingWebview.setFocus()
      currentVisibleWebview = label
      setupResizeListener()
      return
    }

    // Create new child webview embedded in main window
    console.log('[webviewManager] Creating child webview:', label, embedUrl)
    const mainWindow = getCurrentWindow()

    const webview = new Webview(mainWindow, label, {
      url: embedUrl,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      userAgent: CHROME_USER_AGENT,
    })

    // Wait for webview to be created
    await new Promise<void>((resolve, reject) => {
      webview.once('tauri://created', () => {
        console.log('[webviewManager] Child webview created:', label)
        resolve()
      })
      webview.once('tauri://error', (e) => {
        console.error('[webviewManager] Error creating child webview:', e)
        reject(new Error(`Failed to create webview: ${e}`))
      })
    })

    createdWebviews.set(label, webview)
    currentVisibleWebview = label
    setupResizeListener()

    // Listen for main window resize to update webview position
    mainWindow.onResized(handleWindowResize)
  } catch (error) {
    console.error('[webviewManager] Error showing webview:', error)
    throw error
  }
}

/**
 * Closes a webview by its label (destroys it completely)
 */
async function closeWebviewByLabel(label: string): Promise<void> {
  console.log('[webviewManager] closeWebviewByLabel called for:', label)

  try {
    // First try to use our stored instance
    const storedWebview = createdWebviews.get(label)
    if (storedWebview) {
      console.log('[webviewManager] Closing stored webview instance:', label)
      try {
        await storedWebview.close()
        console.log('[webviewManager] Successfully closed stored webview:', label)
      } catch (e) {
        console.error('[webviewManager] Error closing stored webview:', e)
      }
    }

    // Also try to get by label as fallback
    const { Webview } = await import('@tauri-apps/api/webview')
    const webviewByLabel = await Webview.getByLabel(label)
    if (webviewByLabel) {
      console.log('[webviewManager] Found webview by label, closing:', label)
      try {
        await webviewByLabel.close()
        console.log('[webviewManager] Successfully closed webview by label:', label)
      } catch (e) {
        console.error('[webviewManager] Error closing webview by label:', e)
      }
    }

    createdWebviews.delete(label)
    if (currentVisibleWebview === label) {
      currentVisibleWebview = null
    }
  } catch (error) {
    console.error('[webviewManager] Error in closeWebviewByLabel:', label, error)
    createdWebviews.delete(label)
    if (currentVisibleWebview === label) {
      currentVisibleWebview = null
    }
  }
}

/**
 * Closes the current custom page webview
 * Called when navigating away from a custom page
 * Note: Child webviews don't support hide(), so we close them
 */
export async function hideCurrentWebview(): Promise<void> {
  if (!isTauri()) {
    console.log('[webviewManager] hideCurrentWebview: Not in Tauri, skipping')
    return
  }

  const labelToClose = currentVisibleWebview
  console.log('[webviewManager] hideCurrentWebview called, label:', labelToClose)

  if (!labelToClose) {
    console.log('[webviewManager] hideCurrentWebview: No webview to close')
    return
  }

  await closeWebviewByLabel(labelToClose)
}

/**
 * Closes a specific webview by page ID
 */
export async function closeWebview(pageId: string): Promise<void> {
  if (!isTauri()) return
  await closeWebviewByLabel(getWebviewLabel(pageId))
}

/**
 * Closes all custom page webviews
 * Called when navigating to a non-custom-page route
 * Note: Child webviews don't support hide(), so we close them
 */
export async function hideAllCustomPageWebviews(): Promise<void> {
  if (!isTauri()) return

  console.log('[webviewManager] Closing all custom page webviews')

  const labels = Array.from(createdWebviews.keys())
  for (const label of labels) {
    await closeWebviewByLabel(label)
  }

  createdWebviews.clear()
  currentVisibleWebview = null
}

/**
 * @deprecated Use hideAllCustomPageWebviews instead
 */
export async function forceCloseAllCustomPageWebviews(): Promise<void> {
  await hideAllCustomPageWebviews()
}

/**
 * Destroys all custom page webviews completely
 * Use this for cleanup (e.g., on app shutdown)
 */
export async function destroyAllCustomPageWebviews(): Promise<void> {
  if (!isTauri()) return

  console.log('[webviewManager] Destroying all custom page webviews')

  const labels = Array.from(createdWebviews.keys())
  for (const label of labels) {
    await closeWebviewByLabel(label)
  }

  createdWebviews.clear()
  currentVisibleWebview = null
}

/**
 * Closes all custom page webviews
 */
export async function closeAllWebviews(): Promise<void> {
  await destroyAllCustomPageWebviews()
}

/**
 * Gets the currently visible webview label
 */
export function getCurrentVisibleWebview(): string | null {
  return currentVisibleWebview
}

/**
 * Updates the current webview bounds (e.g., when sidebar collapses/expands)
 */
export async function updateCurrentWebviewBounds(): Promise<void> {
  if (!isTauri() || !currentVisibleWebview) return

  try {
    const { Webview } = await import('@tauri-apps/api/webview')
    const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi')

    const webview = await Webview.getByLabel(currentVisibleWebview)
    if (!webview) return

    const bounds = await getContentAreaBounds()
    console.log('[webviewManager] Updating webview bounds:', bounds)

    await webview.setPosition(new LogicalPosition(bounds.x, bounds.y))
    await webview.setSize(new LogicalSize(bounds.width, bounds.height))
  } catch (error) {
    console.error('[webviewManager] Error updating webview bounds:', error)
  }
}
