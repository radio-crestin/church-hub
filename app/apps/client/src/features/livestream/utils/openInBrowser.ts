function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

declare global {
  interface Window {
    __TAURI__?: {
      opener?: {
        openUrl: (url: string) => Promise<void>
      }
      shell?: {
        open: (path: string) => Promise<void>
      }
    }
  }
}

/**
 * Opens a URL in the system's default browser using Tauri's global API.
 */
async function openInTauriBrowser(url: string): Promise<boolean> {
  // biome-ignore lint/suspicious/noConsole: Debug logging
  console.log('[openInTauriBrowser] Attempting to open:', url)
  console.log('[openInTauriBrowser] window.__TAURI__:', window.__TAURI__)

  // Try global Tauri API first (available when withGlobalTauri: true)
  if (window.__TAURI__?.opener?.openUrl) {
    try {
      // biome-ignore lint/suspicious/noConsole: Debug logging
      console.log('[openInTauriBrowser] Using __TAURI__.opener.openUrl')
      await window.__TAURI__.opener.openUrl(url)
      return true
    } catch (e) {
      // biome-ignore lint/suspicious/noConsole: Debug logging
      console.error('[openInTauriBrowser] opener.openUrl failed:', e)
    }
  }

  // Try shell.open
  if (window.__TAURI__?.shell?.open) {
    try {
      // biome-ignore lint/suspicious/noConsole: Debug logging
      console.log('[openInTauriBrowser] Using __TAURI__.shell.open')
      await window.__TAURI__.shell.open(url)
      return true
    } catch (e) {
      // biome-ignore lint/suspicious/noConsole: Debug logging
      console.error('[openInTauriBrowser] shell.open failed:', e)
    }
  }

  // Try dynamic imports as fallback
  try {
    // biome-ignore lint/suspicious/noConsole: Debug logging
    console.log('[openInTauriBrowser] Trying dynamic import of plugin-shell')
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
    return true
  } catch (e) {
    // biome-ignore lint/suspicious/noConsole: Debug logging
    console.error('[openInTauriBrowser] plugin-shell import failed:', e)
  }

  try {
    // biome-ignore lint/suspicious/noConsole: Debug logging
    console.log('[openInTauriBrowser] Trying dynamic import of plugin-opener')
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return true
  } catch (e) {
    // biome-ignore lint/suspicious/noConsole: Debug logging
    console.error('[openInTauriBrowser] plugin-opener import failed:', e)
  }

  return false
}

/**
 * Opens an external URL in the system's default browser.
 * Works in both Tauri and regular browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    const success = await openInTauriBrowser(url)
    if (!success) {
      // Last resort fallback
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Opens a URL in the system's default browser when in Tauri,
 * or in a popup window when in a regular browser.
 */
export async function openAuthUrl(
  url: string,
  options?: { popupName?: string; width?: number; height?: number },
): Promise<Window | null> {
  const { popupName = 'auth', width = 600, height = 700 } = options || {}

  // biome-ignore lint/suspicious/noConsole: Debug logging
  console.log('[openAuthUrl] isTauri:', isTauri(), 'url:', url)

  if (isTauri()) {
    const success = await openInTauriBrowser(url)
    if (success) {
      // biome-ignore lint/suspicious/noConsole: Debug logging
      console.log('[openAuthUrl] Successfully opened in native browser')
      return null
    }
    // biome-ignore lint/suspicious/noConsole: Debug logging
    console.error('[openAuthUrl] All Tauri methods failed, trying window.open')
    return window.open(
      url,
      popupName,
      `width=${width},height=${height},left=100,top=100`,
    )
  }

  // Regular browser - use popup
  return window.open(
    url,
    popupName,
    `width=${width},height=${height},left=100,top=100`,
  )
}

/**
 * Returns true if running in Tauri
 */
export { isTauri }
