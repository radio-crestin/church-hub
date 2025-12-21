function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Opens an external URL in the system's default browser.
 * Works in both Tauri and regular browser environments.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(url)
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Fallback logging
      console.error(
        '[openExternalUrl] Failed to open in browser via Tauri:',
        error,
      )
      // Fallback to window.open
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

  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(url)
      // Return null since we can't get a reference to the external browser window
      return null
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Fallback logging
      console.error('[openAuthUrl] Failed to open in browser via Tauri:', error)
      // Fallback to popup
      return window.open(
        url,
        popupName,
        `width=${width},height=${height},left=100,top=100`,
      )
    }
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
