import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { getChromeUserAgent } from '../utils/getUserAgent'
import { transformToEmbedUrl } from '../utils/transformEmbedUrl'

/**
 * Global webview manager for custom pages
 * Uses Tauri v2 child Webview API to create webviews embedded in the main window
 */

// Track created child webviews by label
// Using interface for the webview methods we need
interface WebviewHandle {
  close: () => Promise<void>
  hide: () => Promise<void>
  show: () => Promise<void>
  setPosition: (position: { x: number; y: number }) => Promise<void>
  setSize: (size: { width: number; height: number }) => Promise<void>
  setFocus: () => Promise<void>
}
const createdWebviews = new Map<string, WebviewHandle>()

// Currently visible webview label
let currentVisibleWebview: string | null = null

// Window resize listener cleanup
let resizeCleanup: (() => void) | null = null

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
    return bounds
  } catch (_error) {
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
  } catch (_error) {}
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

    // Hide any currently visible webview first (keeps it running in background)
    if (currentVisibleWebview && currentVisibleWebview !== label) {
      await hideWebviewByLabel(currentVisibleWebview)
    }

    // Calculate content area bounds
    const bounds = await getContentAreaBounds()

    // Check if webview already exists
    const existingWebview = await Webview.getByLabel(label)
    if (existingWebview) {
      await existingWebview.setPosition(new LogicalPosition(bounds.x, bounds.y))
      await existingWebview.setSize(
        new LogicalSize(bounds.width, bounds.height),
      )
      await existingWebview.show()
      await existingWebview.setFocus()
      currentVisibleWebview = label
      setupResizeListener()
      return
    }
    const mainWindow = getCurrentWindow()

    const userAgent = await getChromeUserAgent()
    const webview = new Webview(mainWindow, label, {
      url: embedUrl,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      userAgent,
    })

    // Wait for webview to be created
    await new Promise<void>((resolve, reject) => {
      webview.once('tauri://created', () => {
        resolve()
      })
      webview.once('tauri://error', (e) => {
        reject(new Error(`Failed to create webview: ${e}`))
      })
    })

    createdWebviews.set(label, webview)
    currentVisibleWebview = label
    setupResizeListener()

    // Listen for main window resize to update webview position
    mainWindow.onResized(handleWindowResize)
  } catch (error) {
    throw error
  }
}

/**
 * Closes a webview by its label (destroys it completely)
 */
async function closeWebviewByLabel(label: string): Promise<void> {
  try {
    // First try to use our stored instance
    const storedWebview = createdWebviews.get(label)
    if (storedWebview) {
      try {
        await storedWebview.close()
      } catch (_e) {}
    }

    // Also try to get by label as fallback
    const { Webview } = await import('@tauri-apps/api/webview')
    const webviewByLabel = await Webview.getByLabel(label)
    if (webviewByLabel) {
      try {
        await webviewByLabel.close()
      } catch (_e) {}
    }

    createdWebviews.delete(label)
    if (currentVisibleWebview === label) {
      currentVisibleWebview = null
    }
  } catch (_error) {
    createdWebviews.delete(label)
    if (currentVisibleWebview === label) {
      currentVisibleWebview = null
    }
  }
}

/**
 * Hides a webview by its label (keeps it running in background)
 * Always moves off-screen to prevent z-index conflicts, plus calls hide() if available
 */
async function hideWebviewByLabel(label: string): Promise<void> {
  try {
    const { Webview } = await import('@tauri-apps/api/webview')
    const { LogicalPosition } = await import('@tauri-apps/api/dpi')

    const webview = await Webview.getByLabel(label)
    if (!webview) {
      return
    }

    // Always move off-screen first to prevent z-index conflicts
    // This ensures the hidden webview won't overlap with newly shown webviews
    await webview.setPosition(new LogicalPosition(-9999, -9999))

    // Also try to call hide() for proper visibility state
    try {
      await webview.hide()
    } catch (_hideError) {}

    if (currentVisibleWebview === label) {
      currentVisibleWebview = null
    }
  } catch (_error) {
    if (currentVisibleWebview === label) {
      currentVisibleWebview = null
    }
  }
}

/**
 * Hides the current custom page webview
 * Called when navigating away from a custom page
 * Keeps the webview running in background for faster switching
 */
export async function hideCurrentWebview(): Promise<void> {
  if (!isTauri()) {
    return
  }

  const labelToHide = currentVisibleWebview

  if (!labelToHide) {
    return
  }

  await hideWebviewByLabel(labelToHide)
}

/**
 * Closes a specific webview by page ID
 */
export async function closeWebview(pageId: string): Promise<void> {
  if (!isTauri()) return
  await closeWebviewByLabel(getWebviewLabel(pageId))
}

/**
 * Hides all custom page webviews
 * Called when navigating to a non-custom-page route
 * Keeps webviews running in background for faster switching
 */
export async function hideAllCustomPageWebviews(): Promise<void> {
  if (!isTauri()) return

  const labels = Array.from(createdWebviews.keys())
  for (const label of labels) {
    await hideWebviewByLabel(label)
  }

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

    await webview.setPosition(new LogicalPosition(bounds.x, bounds.y))
    await webview.setSize(new LogicalSize(bounds.width, bounds.height))
  } catch (_error) {}
}
