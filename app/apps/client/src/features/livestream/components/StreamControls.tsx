import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { useOBSConnection, useStreaming, useYouTubeAuth } from '../hooks'

export function StreamControls() {
  const { t } = useTranslation('livestream')
  const { isAuthenticated } = useYouTubeAuth()
  const { isConnected, isStreaming } = useOBSConnection()
  const { start, stop, isStarting, isStopping, streamStartProgress } =
    useStreaming()

  const canStart = isAuthenticated && isConnected && !isStreaming
  const canStop = isConnected && isStreaming

  const isStartingStream =
    streamStartProgress &&
    streamStartProgress.step !== 'completed' &&
    streamStartProgress.step !== 'error'

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {!isStreaming ? (
        <Button
          variant="primary"
          size="lg"
          onClick={() => start()}
          disabled={!canStart || isStarting || !!isStartingStream}
          className="text-sm sm:text-base px-3 sm:px-4"
        >
          {isStarting || isStartingStream
            ? t('stream.starting')
            : t('stream.startStream')}
        </Button>
      ) : (
        <Button
          variant="danger"
          size="lg"
          onClick={() => stop()}
          disabled={!canStop || isStopping}
          className="text-sm sm:text-base px-3 sm:px-4"
        >
          {isStopping ? t('stream.stopping') : t('stream.stopStream')}
        </Button>
      )}
    </div>
  )
}
