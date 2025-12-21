import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useOBSConnection, useStreaming, useYouTubeAuth } from '../hooks'

export function StreamControls() {
  const { t } = useTranslation('livestream')
  const { isAuthenticated } = useYouTubeAuth()
  const { isConnected, isStreaming } = useOBSConnection()
  const { start, stop, isStarting, isStopping, isLive, streamStartProgress } =
    useStreaming()

  const canStart = isAuthenticated && isConnected && !isStreaming
  const canStop = isConnected && isStreaming

  const showProgress =
    streamStartProgress &&
    streamStartProgress.step !== 'completed' &&
    streamStartProgress.step !== 'error'

  return (
    <div className="flex flex-col gap-4">
      {showProgress && (
        <div className="flex flex-col gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {t(`stream.progress.${streamStartProgress.step}`)}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {streamStartProgress.progress}%
            </span>
          </div>
          <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300"
              style={{ width: `${streamStartProgress.progress}%` }}
            />
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {streamStartProgress.message}
          </p>
        </div>
      )}

      {streamStartProgress?.step === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <span className="text-sm text-red-600 dark:text-red-400">
            {streamStartProgress.error || t('errors.startStreamFailed')}
          </span>
        </div>
      )}

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
            disabled={!canStart || isStarting || !!showProgress}
            className="min-w-[160px]"
          >
            {isStarting || showProgress
              ? t('stream.starting')
              : t('stream.startStream')}
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
    </div>
  )
}
