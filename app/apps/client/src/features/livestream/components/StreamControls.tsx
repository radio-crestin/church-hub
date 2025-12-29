import { Radio, Square } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '../../../ui/modal'
import { Tooltip } from '../../../ui/tooltip'
import { useOBSConnection, useStreaming, useYouTubeAuth } from '../hooks'

export function StreamControls() {
  const { t } = useTranslation('livestream')
  const { isAuthenticated } = useYouTubeAuth()
  const { isConnected, isStreaming } = useOBSConnection()
  const { start, stop, isStarting, isStopping, streamStartProgress } =
    useStreaming()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const hasConnection = isAuthenticated || isConnected
  const canStart = hasConnection && !isStreaming

  const isStartingStream =
    streamStartProgress &&
    streamStartProgress.step !== 'completed' &&
    streamStartProgress.step !== 'error'

  const handleButtonClick = () => {
    if (isStartingStream) {
      setShowCancelConfirm(true)
    } else if (canStart && !isStarting) {
      start()
    }
  }

  const handleCancelConfirm = () => {
    setShowCancelConfirm(false)
    stop()
  }

  const isButtonDisabled = !hasConnection || isStarting

  const startButton = (
    <button
      onClick={handleButtonClick}
      disabled={isButtonDisabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg px-3 sm:px-4 py-3 text-sm sm:text-base text-white transition-colors ${
        hasConnection
          ? 'bg-[#FF0000] hover:bg-[#CC0000] disabled:cursor-not-allowed'
          : 'bg-red-900 cursor-not-allowed'
      }`}
    >
      <span className="flex items-center gap-2">
        <Radio className="w-4 h-4" />
        {isStarting || isStartingStream
          ? t('stream.starting')
          : t('stream.startStream')}
      </span>
    </button>
  )

  return (
    <>
      <div className="flex items-center">
        {!isStreaming ? (
          !hasConnection ? (
            <Tooltip content={t('stream.connectRequired')} position="bottom">
              {startButton}
            </Tooltip>
          ) : (
            startButton
          )
        ) : (
          <button
            onClick={() => stop()}
            disabled={isStopping}
            className="inline-flex items-center justify-center font-medium rounded-lg px-3 sm:px-4 py-3 text-sm sm:text-base text-white bg-[#FF0000] hover:bg-[#CC0000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
              <Square className="w-4 h-4 fill-current" />
              {isStopping ? t('stream.stopping') : t('stream.stopStream')}
            </span>
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={showCancelConfirm}
        title={t('stream.cancelConfirm.title')}
        message={t('stream.cancelConfirm.message')}
        confirmLabel={t('stream.cancelConfirm.confirm')}
        cancelLabel={t('stream.cancelConfirm.cancel')}
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
        variant="danger"
      />
    </>
  )
}
