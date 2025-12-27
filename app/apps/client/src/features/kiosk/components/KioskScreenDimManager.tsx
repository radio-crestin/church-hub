import { useWebSocket } from '~/features/presentation/hooks/useWebSocket'
import { KioskDisconnectionMessage } from './KioskDisconnectionMessage'
import { KioskScreenDimOverlay } from './KioskScreenDimOverlay'
import { useKioskScreenDim } from '../hooks/useKioskScreenDim'
import { useKioskSettings } from '../hooks/useKioskSettings'

/**
 * Component that manages screen dim overlay for kiosk mode
 * Shows disconnection message immediately when WebSocket disconnects
 * Shows black overlay after 1-minute delay
 */
export function KioskScreenDimManager() {
  const { data: kioskSettings } = useKioskSettings()
  const { status: wsStatus } = useWebSocket()

  const kioskEnabled = kioskSettings?.enabled ?? false
  const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error'

  const { isOverlayVisible, dismissOverlay } = useKioskScreenDim({
    kioskEnabled,
    wsStatus,
  })

  // Show disconnection message immediately when disconnected in kiosk mode
  const showDisconnectionMessage = kioskEnabled && isDisconnected

  return (
    <>
      {showDisconnectionMessage && !isOverlayVisible && (
        <KioskDisconnectionMessage />
      )}
      {isOverlayVisible && <KioskScreenDimOverlay onDismiss={dismissOverlay} />}
    </>
  )
}
