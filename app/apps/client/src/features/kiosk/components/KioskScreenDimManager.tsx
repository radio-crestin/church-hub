import { useState } from 'react'

import { ServerConnectionModal } from '~/features/api-url-config/components/ServerConnectionModal'
import { useWebSocket } from '~/features/presentation/hooks/useWebSocket'
import { KioskDisconnectionMessage } from './KioskDisconnectionMessage'
import { KioskScreenDimOverlay } from './KioskScreenDimOverlay'
import { useKioskScreenDim } from '../hooks/useKioskScreenDim'
import { useKioskSettings } from '../hooks/useKioskSettings'

/**
 * Component that manages screen dim overlay for kiosk mode
 * Shows disconnection message immediately when WebSocket disconnects
 * Shows black overlay after 1-minute delay
 * On mobile, allows tapping the disconnection message to open reconnection modal
 */
export function KioskScreenDimManager() {
  const { data: kioskSettings } = useKioskSettings()
  const { status: wsStatus, debugInfo } = useWebSocket()
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false)

  const kioskEnabled = kioskSettings?.enabled ?? false
  const isDisconnected = wsStatus === 'disconnected' || wsStatus === 'error'

  const { isOverlayVisible, dismissOverlay } = useKioskScreenDim({
    kioskEnabled,
    wsStatus,
    disconnectCount: debugInfo.disconnectCount,
  })

  // Show disconnection message immediately when disconnected in kiosk mode
  const showDisconnectionMessage = kioskEnabled && isDisconnected

  const handleDisconnectionClick = () => {
    setIsConnectionModalOpen(true)
  }

  const handleModalClose = () => {
    setIsConnectionModalOpen(false)
  }

  const handleConnected = () => {
    setIsConnectionModalOpen(false)
  }

  return (
    <>
      {showDisconnectionMessage && !isOverlayVisible && (
        <KioskDisconnectionMessage onClick={handleDisconnectionClick} />
      )}
      {isOverlayVisible && <KioskScreenDimOverlay onDismiss={dismissOverlay} />}
      <ServerConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={handleModalClose}
        onConnected={handleConnected}
      />
    </>
  )
}
