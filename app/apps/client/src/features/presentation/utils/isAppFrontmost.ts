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
 */
export async function isAppFrontmost(): Promise<boolean> {
  try {
    const { getAllWebviewWindows } = await import(
      '@tauri-apps/api/webviewWindow'
    )
    const windows = await getAllWebviewWindows()
    const focusStates = await Promise.all(
      windows.map((appWindow) => appWindow.isFocused().catch(() => false)),
    )
    return focusStates.some(Boolean)
  } catch {
    // Unknown state: never steal focus on a guess.
    return false
  }
}
