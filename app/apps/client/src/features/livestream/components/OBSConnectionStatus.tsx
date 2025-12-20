import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OBSSetupModal } from './OBSSetupModal'
import { Button } from '../../../ui/button/Button'
import { useOBSConnection } from '../hooks'

export function OBSConnectionStatus() {
  const { t } = useTranslation('livestream')
  const { isConnected, isConnecting, isDisconnecting, connect, disconnect } =
    useOBSConnection()
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-green-500'
                  : isConnecting
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnecting
                ? t('obs.connecting')
                : isConnected
                  ? t('obs.connected')
                  : t('obs.disconnected')}
            </span>
          </div>

          {isConnected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnect()}
              disabled={isDisconnecting}
            >
              {t('obs.disconnect')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => connect()}
              disabled={isConnecting}
            >
              {t('obs.connect')}
            </Button>
          )}
        </div>

        {!isConnected && !isConnecting && (
          <button
            type="button"
            onClick={() => setIsSetupModalOpen(true)}
            className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('obs.setup.helpLink')}
          </button>
        )}
      </div>

      <OBSSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </>
  )
}
