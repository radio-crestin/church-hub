import { Radio, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isMIDIShortcut, useAppShortcuts } from '~/features/keyboard-shortcuts'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { ConfirmModal } from '../../../ui/modal'
import { Tooltip } from '../../../ui/tooltip'
import { useOBSConnection, useStreaming, useYouTubeAuth } from '../hooks'

export function StreamControls() {
  const { t } = useTranslation('livestream')
  const { isAuthenticated } = useYouTubeAuth()
  const { isConnected } = useOBSConnection()
  const { start, stop, isStarting, isStopping, streamStartProgress, isLive } =
    useStreaming()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Get stream shortcuts for display (keyboard shortcuts only, no MIDI)
  const { shortcuts } = useAppShortcuts()
  const startLiveShortcut = useMemo(() => {
    const action = shortcuts.actions.startLive
    if (!action?.enabled) return undefined
    const keyboardShortcut = action.shortcuts.find((s) => !isMIDIShortcut(s))
    return keyboardShortcut
  }, [shortcuts])
  const stopLiveShortcut = useMemo(() => {
    const action = shortcuts.actions.stopLive
    if (!action?.enabled) return undefined
    const keyboardShortcut = action.shortcuts.find((s) => !isMIDIShortcut(s))
    return keyboardShortcut
  }, [shortcuts])

  const hasConnection = isAuthenticated || isConnected
  const canStart = hasConnection && !isLive

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
      className={`inline-flex h-8 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-white transition-colors ${
        hasConnection
          ? 'bg-primary hover:bg-indigo-700 disabled:cursor-not-allowed'
          : 'bg-primary opacity-50 cursor-not-allowed'
      }`}
    >
      <span className="flex items-center gap-2">
        <Radio size={16} strokeWidth={1.5} />
        {isStarting || isStartingStream
          ? t('stream.starting')
          : t('stream.startStream')}
        {startLiveShortcut && !isStarting && !isStartingStream && (
          <KeyboardShortcutBadge
            shortcut={startLiveShortcut}
            className="text-white/80"
          />
        )}
      </span>
    </button>
  )

  return (
    <>
      <div className="flex items-center">
        {!isLive ? (
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
            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="flex items-center gap-2">
              <Square size={14} strokeWidth={1.75} className="fill-current" />
              {isStopping ? t('stream.stopping') : t('stream.stopStream')}
              {stopLiveShortcut && !isStopping && (
                <KeyboardShortcutBadge
                  shortcut={stopLiveShortcut}
                  className="text-white/80"
                />
              )}
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white" />
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
