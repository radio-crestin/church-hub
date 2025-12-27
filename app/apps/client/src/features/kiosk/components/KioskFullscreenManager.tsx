import { useKioskFullscreen } from '../hooks/useKioskFullscreen'
import { useKioskSettings } from '../hooks/useKioskSettings'

/**
 * Component that manages fullscreen mode for kiosk
 * Renders nothing - just handles the fullscreen lifecycle
 *
 * On iOS Tauri, the app is already fullscreen in the native container.
 * On desktop/browser, this attempts to enter fullscreen mode.
 */
export function KioskFullscreenManager() {
  const { data: kioskSettings } = useKioskSettings()
  const kioskEnabled = kioskSettings?.enabled ?? false

  useKioskFullscreen({ enabled: kioskEnabled })

  return null
}
