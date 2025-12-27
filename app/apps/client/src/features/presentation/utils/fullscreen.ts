import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

/**
 * Gets the current platform using browser detection as primary method
 */
function getCurrentPlatform(): string {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows'
  }
  if (
    platform.includes('mac') ||
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os')
  ) {
    return 'macos'
  }
  if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux'
  }
  return 'unknown'
}

/**
 * Sets fullscreen state for a Tauri window with cross-platform support.
 * On macOS, uses setSimpleFullscreen as a fallback since regular fullscreen
 * may not work reliably for dynamically created webview windows.
 * On Windows, uses maximize + hide decorations as a fallback.
 *
 * @returns true if fullscreen was successfully set, false otherwise
 */
export async function setWindowFullscreen(
  win: WebviewWindow,
  fullscreen: boolean,
): Promise<boolean> {
  const currentPlatform = getCurrentPlatform()
  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
  console.log(
    `[setWindowFullscreen] Platform: ${currentPlatform}, setting fullscreen: ${fullscreen}`,
  )

  // Helper to verify fullscreen state
  const verifyFullscreen = async (): Promise<boolean> => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const state = await win.isFullscreen()
      return state === fullscreen
    } catch {
      return false
    }
  }

  // Helper to check if window is maximized (for Windows fallback verification)
  const verifyMaximized = async (): Promise<boolean> => {
    try {
      const isMax = await win.isMaximized()
      // For entering "fullscreen" via maximize, we want maximized=true
      // For exiting, we want maximized=false
      return fullscreen ? isMax : !isMax
    } catch {
      return false
    }
  }

  // Method 1: Try regular setFullscreen
  try {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log('[setWindowFullscreen] Trying win.setFullscreen()...')
    await win.setFullscreen(fullscreen)

    if (await verifyFullscreen()) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log(
        `[setWindowFullscreen] setFullscreen(${fullscreen}) succeeded!`,
      )
      return true
    }
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(
      '[setWindowFullscreen] setFullscreen did not achieve desired state',
    )
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.error('[setWindowFullscreen] setFullscreen threw error:', error)
  }

  // Method 2: Platform-specific fallbacks
  if (currentPlatform === 'macos') {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[setWindowFullscreen] Trying macOS setSimpleFullscreen...')
      await win.setSimpleFullscreen(fullscreen)
      // setSimpleFullscreen doesn't update isFullscreen, so assume success if no error
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log(
        `[setWindowFullscreen] setSimpleFullscreen(${fullscreen}) called`,
      )
      return true
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.error('[setWindowFullscreen] setSimpleFullscreen failed:', error)
    }
  } else if (currentPlatform === 'windows') {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log(
        '[setWindowFullscreen] Trying Windows maximize+decorations fallback...',
      )
      if (fullscreen) {
        await win.setDecorations(false)
        await win.maximize()
      } else {
        await win.unmaximize()
        await win.setDecorations(true)
      }

      if (await verifyMaximized()) {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.log(`[setWindowFullscreen] Windows fallback succeeded!`)
        return true
      }
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log(
        '[setWindowFullscreen] Windows fallback did not achieve desired state',
      )
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.error('[setWindowFullscreen] Windows fallback failed:', error)
    }
  }

  // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
  console.error(
    `[setWindowFullscreen] All Tauri methods failed for platform: ${currentPlatform}`,
  )
  return false
}

/**
 * Toggles fullscreen state for a Tauri window with cross-platform support.
 * @returns true if fullscreen was successfully toggled, false otherwise
 */
export async function toggleWindowFullscreen(
  win: WebviewWindow,
): Promise<boolean> {
  try {
    // Check current state
    const isFullscreen = await win.isFullscreen()

    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log(
      `[toggleWindowFullscreen] Current state: ${isFullscreen}, toggling to: ${!isFullscreen}`,
    )

    return await setWindowFullscreen(win, !isFullscreen)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.error('[toggleWindowFullscreen] Error:', error)
    return false
  }
}
