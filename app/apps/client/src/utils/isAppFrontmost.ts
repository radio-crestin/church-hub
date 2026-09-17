import { createLogger } from '~/utils/logger'

const logger = createLogger('app:focus')

/**
 * Whether any Church Hub window currently holds the keyboard.
 *
 * On macOS `setFocus()` activates the whole application over whatever the user
 * is working in (`activateIgnoringOtherApps`), so every focus re-assert has to
 * ask this first: once the operator has switched to another app, Church Hub
 * must stay where it is instead of pulling itself back to the front.
 *
 * Any Church Hub window counts — the control window and the projection windows
 * are all ours, so a focused projector still means the app is frontmost and a
 * handover between our own windows is fair game.
 *
 * The page asking comes first. `document.hasFocus()` is true only while its
 * window is the active one and its webview has the keyboard, and every engine
 * the app runs in (WKWebView, WebView2, WebKitGTK) reports it. A window's own
 * `isFocused()` does not: it is always false on Linux, and on Windows the
 * window reads as blurred as soon as WebView2 takes the keyboard — so asked on
 * its own it answered "not frontmost" to an operator clicking Present, and the
 * keyboard was never handed back from the projection.
 */
export async function isAppFrontmost(): Promise<boolean> {
  const documentHasFocus = document.hasFocus()
  if (documentHasFocus) {
    logger.debug('Frontmost: this page has the keyboard', {
      documentHasFocus,
    })
    return true
  }

  try {
    const { getAllWebviewWindows } = await import(
      '@tauri-apps/api/webviewWindow'
    )
    const windows = await getAllWebviewWindows()
    const focusStates = await Promise.all(
      windows.map((appWindow) => appWindow.isFocused().catch(() => false)),
    )
    const frontmost = focusStates.some(Boolean)
    logger.debug(`Frontmost: ${frontmost}`, {
      documentHasFocus,
      isFocused: Object.fromEntries(
        windows.map((appWindow, index) => [
          appWindow.label,
          focusStates[index],
        ]),
      ),
    })
    return frontmost
  } catch (error) {
    // Unknown state: never steal focus on a guess.
    logger.debug('Frontmost: unknown, answering no', {
      documentHasFocus,
      error,
    })
    return false
  }
}
