import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useOBSConnection, useStreaming, useYouTubeAuth } from '../hooks'

export function StreamControls() {
  const { t } = useTranslation('livestream')
  const { isAuthenticated } = useYouTubeAuth()
  const { isConnected, isStreaming } = useOBSConnection()
  const { start, stop, isStarting, isStopping, isLive } = useStreaming()

  const canStart = isAuthenticated && isConnected && !isStreaming
  const canStop = isConnected && isStreaming

  return (
    <div className="flex items-center gap-4">
      {isLive && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full" />
          <span className="text-sm font-bold text-white">
            {t('stream.isLive')}
          </span>
        </div>
      )}

      {!isStreaming ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => start()}
          disabled={!canStart || isStarting}
          className="min-w-[160px]"
        >
          {isStarting ? t('stream.starting') : t('stream.startStream')}
        </Button>
      ) : (
        <Button
          variant="danger"
          size="lg"
          onClick={() => stop()}
          disabled={!canStop || isStopping}
          className="min-w-[160px]"
        >
          {isStopping ? t('stream.stopping') : t('stream.stopStream')}
        </Button>
      )}

      {!isAuthenticated && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {t('youtube.notConnected')}
        </p>
      )}

      {!isConnected && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {t('obs.disconnected')}
        </p>
      )}
    </div>
  )
}
