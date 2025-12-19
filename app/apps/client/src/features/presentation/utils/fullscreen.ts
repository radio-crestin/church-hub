import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/**
 * Sets fullscreen state for a Tauri window with cross-platform support.
 * On macOS, uses setSimpleFullscreen as a fallback since regular fullscreen
 * may not work reliably for dynamically created webview windows.
 */
export async function setWindowFullscreen(
  win: WebviewWindow,
  fullscreen: boolean,
): Promise<void> {
  try {
    // Try regular fullscreen first
    await win.setFullscreen(fullscreen)

    // Verify it worked
    const isFullscreen = await win.isFullscreen()
    if (isFullscreen === fullscreen) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log(
        `[setWindowFullscreen] setFullscreen(${fullscreen}) succeeded`,
      )
      return
    }

    // If regular fullscreen didn't work, try setSimpleFullscreen on macOS
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(
      '[setWindowFullscreen] setFullscreen did not work, trying setSimpleFullscreen',
    )
    await win.setSimpleFullscreen(fullscreen)
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(
      `[setWindowFullscreen] setSimpleFullscreen(${fullscreen}) called`,
    )
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.error('[setWindowFullscreen] Error:', error)

    // Final fallback: try setSimpleFullscreen
    try {
      await win.setSimpleFullscreen(fullscreen)
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log(
        `[setWindowFullscreen] Fallback setSimpleFullscreen(${fullscreen}) called`,
      )
    } catch (fallbackError) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.error(
        '[setWindowFullscreen] Fallback also failed:',
        fallbackError,
      )
    }
  }
}

/**
 * Toggles fullscreen state for a Tauri window with cross-platform support.
 */
export async function toggleWindowFullscreen(
  win: WebviewWindow,
): Promise<void> {
  try {
    // Check current state
    const isFullscreen = await win.isFullscreen()

    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(
      `[toggleWindowFullscreen] Current state: ${isFullscreen}, toggling to: ${!isFullscreen}`,
    )

    await setWindowFullscreen(win, !isFullscreen)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.error('[toggleWindowFullscreen] Error:', error)
  }
}
