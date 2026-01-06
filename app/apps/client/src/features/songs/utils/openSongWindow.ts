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
  console.log(
    '[openSongWindow] Called with songId:',
    songId,
    'title:',
    songTitle,
  )
  const url = `${getFrontendUrl()}/songs/${songId}`
  console.log('[openSongWindow] URL:', url, 'isTauri:', isTauri())

  if (isTauri()) {
    try {
      console.log('[openSongWindow] In Tauri mode, importing APIs...')
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      console.log('[openSongWindow] APIs imported successfully')

      const windowLabel = `song-${songId}`
      console.log('[openSongWindow] Window label:', windowLabel)

      // Check if window already exists
      const existingWindow = await WebviewWindow.getByLabel(windowLabel)
      console.log('[openSongWindow] Existing window:', existingWindow)
      if (existingWindow) {
        console.log('[openSongWindow] Window exists, focusing...')
        await existingWindow.setFocus()
        return
      }

      // Get main window info for positioning
      const mainWindow = getCurrentWindow()
      const mainPosition = await mainWindow.outerPosition()
      const mainSize = await mainWindow.outerSize()

      console.log('[openSongWindow] Main window position:', mainPosition)
      console.log('[openSongWindow] Main window size:', mainSize)

      // Position new window offset from main window
      const x = mainPosition.x + 50
      const y = mainPosition.y + 50

      console.log('[openSongWindow] Creating window at x:', x, 'y:', y)
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
    } catch (error) {
      console.error('[openSongWindow] Error:', error)
      window.open(url, '_blank')
    }
  } else {
    console.log('[openSongWindow] Not in Tauri, opening in browser')
    window.open(url, '_blank')
  }
}
