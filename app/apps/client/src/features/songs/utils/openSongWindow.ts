import {
  getFrontendUrl,
  isTauri,
} from '~/features/presentation/utils/openDisplayWindow'

/**
 * Opens a song in a new window/tab
 */
export async function openSongWindow(
  songId: number,
  songTitle?: string,
): Promise<void> {
  const url = `${getFrontendUrl()}/songs/${songId}`

  if (isTauri()) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')

      const windowLabel = `song-${songId}`

      // Check if window already exists
      const existingWindow = await WebviewWindow.getByLabel(windowLabel)
      if (existingWindow) {
        await existingWindow.setFocus()
        return
      }

      // Get main window info for positioning
      const mainWindow = getCurrentWindow()
      const mainPosition = await mainWindow.outerPosition()
      const mainSize = await mainWindow.outerSize()

      // Position new window offset from main window
      const x = mainPosition.x + 50
      const y = mainPosition.y + 50

      new WebviewWindow(windowLabel, {
        url,
        title: songTitle || `Song ${songId}`,
        width: mainSize.width,
        height: mainSize.height,
        x,
        y,
        resizable: true,
        maximizable: true,
        minimizable: true,
        decorations: true,
        focus: true,
      })
    } catch {
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}
