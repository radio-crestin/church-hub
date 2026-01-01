import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isMobile } from '~/config'

interface KioskDisconnectionMessageProps {
  onClick?: () => void
}

/**
 * Displays a disconnection message in the bottom left corner
 * when WebSocket connection is lost in kiosk mode.
 * On mobile, it's clickable to open the server connection modal.
 */
export function KioskDisconnectionMessage({
  onClick,
}: KioskDisconnectionMessageProps) {
  const { t } = useTranslation('common')
  const isClickable = isMobile() && onClick

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`fixed bottom-4 left-4 z-[9998] flex flex-col items-start gap-1 rounded-lg bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur-sm ${
        isClickable ? 'cursor-pointer active:bg-black/90' : 'cursor-default'
      }`}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-5 w-5 text-red-400" />
        <span className="text-sm font-medium">
          {t('connection.connectionLost')}
        </span>
      </div>
      {isClickable && (
        <span className="text-xs text-gray-400 ml-7">
          {t('connection.tapToReconnect')}
        </span>
      )}
    </button>
  )
}
