import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { createLogger } from '~/utils/logger'

const logger = createLogger('keyboard-shortcuts:focusMainWindow')

/**
 * Focuses the main Tauri window.
 * This is needed when global shortcuts are triggered while the app is in the background,
 * to ensure that subsequent input focus() calls work properly.
 */
export async function focusMainWindow(): Promise<void> {
  if (!isTauri()) {
    return
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const mainWindow = getCurrentWindow()
    await mainWindow.setFocus()
    // Delay to allow the OS to actually bring the window to the foreground
    // before we try to focus any input elements
    await new Promise((resolve) => setTimeout(resolve, 100))
    logger.debug('Main window focused')
  } catch (error) {
    logger.error('Failed to focus main window:', error)
  }
}
