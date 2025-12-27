import { useWebSocket } from '~/features/presentation/hooks/useWebSocket'
import { KioskScreenDimOverlay } from './KioskScreenDimOverlay'
import { useKioskScreenDim } from '../hooks/useKioskScreenDim'
import { useKioskSettings } from '../hooks/useKioskSettings'

/**
 * Component that manages screen dim overlay for kiosk mode
 * Shows black overlay when WebSocket disconnects
 * Renders overlay only when visible
 */
export function KioskScreenDimManager() {
  const { data: kioskSettings } = useKioskSettings()
  const { status: wsStatus } = useWebSocket()

  const { isOverlayVisible, dismissOverlay } = useKioskScreenDim({
    kioskEnabled: kioskSettings?.enabled ?? false,
    wsStatus,
  })

  if (!isOverlayVisible) return null

  return <KioskScreenDimOverlay onDismiss={dismissOverlay} />
}
