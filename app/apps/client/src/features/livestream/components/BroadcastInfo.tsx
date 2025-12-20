import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useBroadcastMessage, useStreaming } from '../hooks'

export function BroadcastInfo() {
  const { t } = useTranslation('livestream')
  const { activeBroadcast, isLive } = useStreaming()
  const { copyMessage, copied, isLoading } = useBroadcastMessage()

  if (!activeBroadcast) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">
          {t('broadcast.noBroadcast')}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {t('broadcast.currentBroadcast')}
        </h3>
        {isLive && (
          <span className="px-2 py-1 text-xs font-bold text-white bg-red-600 rounded">
            {t('stream.isLive')}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {activeBroadcast.title}
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={activeBroadcast.url}
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => copyMessage(activeBroadcast.url)}
            disabled={isLoading}
          >
            {copied ? t('broadcast.messageCopied') : t('broadcast.copyMessage')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(activeBroadcast.url, '_blank')}
          >
            {t('broadcast.openInYouTube')}
          </Button>
        </div>
      </div>
    </div>
  )
}
