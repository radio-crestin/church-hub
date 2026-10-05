import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'
import { useNotificationWhile } from '~/ui/notifications'

/**
 * "Connection lost" banner for kiosk mode, shown while the WebSocket is down.
 * On mobile it offers a reconnect button that opens the connection dialog.
 */
export function useKioskDisconnectionNotice(
  isDisconnected: boolean,
  onReconnect: () => void,
) {
  const { t } = useTranslation('common')

  useNotificationWhile(isDisconnected, {
    id: 'kiosk-connection-lost',
    kind: 'warning',
    message: t('connection.connectionLost'),
    dismissible: false,
    action: isMobile()
      ? { label: t('connection.tapToReconnect'), onClick: onReconnect }
      : undefined,
  })
}
