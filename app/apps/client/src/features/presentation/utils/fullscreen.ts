import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { listMonitors, monitorContains } from './monitors'

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
 * How long to wait for the window manager to report the state we asked for.
 * macOS animates into fullscreen over the best part of a second, and a single
 * short check used to time out on that animation and fall through to the simple
 * fullscreen fallback for a window that was going fullscreen perfectly well.
 */
const FULLSCREEN_SETTLE_MS = 1500
const FULLSCREEN_POLL_MS = 100

/**
 * Sets fullscreen state for a Tauri window with cross-platform support.
 *
 * On macOS, `setSimpleFullscreen` is the fallback for windows the real
 * fullscreen refuses to take. It is also the trap on the way out: a window in
 * simple fullscreen reports `isFullscreen() === false`, so an exit that only
 * called `setFullscreen(false)` looked like it had worked while the window
 * stayed borderless and pinned over the whole display — no title bar to grab,
 * nothing to drag. Leaving therefore clears simple fullscreen first, always.
 *
 * On Windows, maximize with the chrome off stands in for fullscreen.
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

  // Going in: the chrome comes off first, so the window has none to animate.
  if (fullscreen) {
    await setDecorations(win, false)
  } else if (currentPlatform === 'macos') {
    // Coming out: clear simple fullscreen before anything reads the window's
    // state, or the check below is answered by a window that is still stuck.
    // A no-op when the window was never in it.
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[setWindowFullscreen] Clearing macOS simple fullscreen')
      await win.setSimpleFullscreen(false)
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.warn('[setWindowFullscreen] setSimpleFullscreen(false):', error)
    }
  }

  const success = await applyFullscreen(win, fullscreen, currentPlatform)

  // Coming out: the chrome goes back only once the window has left fullscreen.
  // Restyling a window that is still filling the screen is what leaves it
  // borderless and unmovable on macOS.
  if (!fullscreen) {
    await setDecorations(win, true)
    await shrinkOffTheDisplay(win)
  }

  return success
}

/** Fraction of its display a window that has left fullscreen falls back to. */
const WINDOWED_SHARE = 0.7

/**
 * Gives a window that has just left fullscreen a shape the operator can work
 * with.
 *
 * Leaving fullscreen puts the chrome back but leaves the window covering the
 * whole display, which pushes its title bar past the top edge of the screen:
 * there is nothing left to grab and nowhere to drag it to. A window that is
 * already smaller than its display is left exactly where the operator put it.
 */
async function shrinkOffTheDisplay(win: WebviewWindow): Promise<void> {
  try {
    const { PhysicalPosition, PhysicalSize } = await import(
      '@tauri-apps/api/dpi'
    )
    const position = await win.outerPosition()
    const size = await win.outerSize()
    const monitor = (await listMonitors()).find((candidate) =>
      monitorContains(candidate, position.x, position.y),
    )
    if (!monitor) return
    if (size.width < monitor.width || size.height < monitor.height) return

    const width = Math.round(monitor.width * WINDOWED_SHARE)
    const height = Math.round(monitor.height * WINDOWED_SHARE)
    await win.setSize(new PhysicalSize(width, height))
    await win.setPosition(
      new PhysicalPosition(
        monitor.x + Math.round((monitor.width - width) / 2),
        monitor.y + Math.round((monitor.height - height) / 2),
      ),
    )
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.warn(
      '[setWindowFullscreen] Failed to restore window bounds:',
      error,
    )
  }
}

/** Puts the window in or out of fullscreen, however the platform will allow. */
async function applyFullscreen(
  win: WebviewWindow,
  fullscreen: boolean,
  platform: string,
): Promise<boolean> {
  // Method 1: Try regular setFullscreen
  try {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.log('[setWindowFullscreen] Trying win.setFullscreen()...')
    await win.setFullscreen(fullscreen)

    if (await settlesAt(win, fullscreen)) {
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
  if (platform === 'macos') {
    // Only ever entered here: the exit already cleared simple fullscreen above.
    if (!fullscreen) return true
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[setWindowFullscreen] Trying macOS setSimpleFullscreen...')
      await win.setSimpleFullscreen(true)
      // setSimpleFullscreen doesn't update isFullscreen, so assume success if no error
      return true
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.error('[setWindowFullscreen] setSimpleFullscreen failed:', error)
    }
  } else if (platform === 'windows') {
    try {
      // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
      console.log('[setWindowFullscreen] Trying Windows maximize fallback...')
      // The chrome is handled by the caller; maximising a chromeless window is
      // as close to fullscreen as Windows gets when setFullscreen refuses.
      if (fullscreen) {
        await win.maximize()
      } else {
        await win.unmaximize()
      }

      const maximized = await win.isMaximized()
      if (fullscreen ? maximized : !maximized) {
        // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
        console.log('[setWindowFullscreen] Windows fallback succeeded!')
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
    `[setWindowFullscreen] All Tauri methods failed for platform: ${platform}`,
  )
  return false
}

/** Waits for the window to report the state it was asked for. */
async function settlesAt(
  win: WebviewWindow,
  fullscreen: boolean,
): Promise<boolean> {
  const deadline = FULLSCREEN_SETTLE_MS / FULLSCREEN_POLL_MS
  for (let attempt = 0; attempt < deadline; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, FULLSCREEN_POLL_MS))
    try {
      if ((await win.isFullscreen()) === fullscreen) return true
    } catch {
      return false
    }
  }
  return false
}

/** Takes the window's chrome on or off, never throwing into the caller. */
async function setDecorations(
  win: WebviewWindow,
  decorated: boolean,
): Promise<void> {
  try {
    await win.setDecorations(decorated)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Critical debugging for Tauri
    console.warn('[setWindowFullscreen] setDecorations failed:', error)
  }
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
