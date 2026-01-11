import {
  Eraser,
  Eye,
  EyeOff,
  Loader2,
  MonitorOff,
  MonitorPlay,
  MonitorUp,
  Settings,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatShortcutForDisplay,
  useAppShortcuts,
} from '~/features/keyboard-shortcuts'
import { ContentTypeButton } from './ContentTypeButton'
import { ControlRoomSettingsModal } from './ControlRoomSettingsModal'
import { LivePreview } from './LivePreview'
import { useScreenShareContext } from '../context'
import {
  useClearSlide,
  useClearTemporaryContent,
  usePresentationState,
  useShowSlide,
  useWebSocket,
} from '../hooks'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '../hooks/useSlideHighlights'

export function ControlRoom() {
  const { t } = useTranslation(['presentation', 'common'])

  // Connect to WebSocket for real-time updates
  const { send: wsSend } = useWebSocket()

  // Get screen share context (persists across page navigations)
  const {
    state: screenShareState,
    startScreenShare,
    stopScreenShare,
    setClientId,
    setSend,
  } = useScreenShareContext()

  // Generate a stable client ID for this session
  const clientId = useMemo(() => {
    return `control-room-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }, [])

  // Initialize the screen share context with client ID and send function
  useEffect(() => {
    setClientId(clientId)
    setSend(wsSend)
  }, [clientId, wsSend, setClientId, setSend])

  // Start screen share with audio always enabled (audio playback controlled per-screen)
  const handleStartScreenShare = useCallback(() => {
    startScreenShare({ audio: true })
  }, [startScreenShare])

  // Stop screen share (any client can stop)
  const handleStopScreenShare = useCallback(() => {
    // Send stop command - works for both broadcaster and other clients
    wsSend({ type: 'screen_share_stop' })
    // If we're the broadcaster, also stop our local stream
    stopScreenShare()
  }, [wsSend, stopScreenShare])

  const { data: state } = usePresentationState()
  const clearSlide = useClearSlide()
  const showSlideCommand = useShowSlide()
  const clearTemporary = useClearTemporaryContent()

  // Get configured showSlide shortcut for display
  const { shortcuts } = useAppShortcuts()
  const showSlideShortcut = useMemo(() => {
    const action = shortcuts.actions.showSlide
    return action?.enabled && action.shortcuts.length > 0
      ? action.shortcuts[0]
      : undefined
  }, [shortcuts])

  // Highlight management (auto-clear is handled globally in AppLayout)
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  // Check if we have temporary content
  const hasTemporaryContent = !!state?.temporaryContent
  const isHidden = state?.isHidden ?? true

  // Show = display the last slide
  const handleShow = async () => {
    if (state?.lastSongSlideId) {
      await showSlideCommand.mutateAsync()
    }
  }

  // Hide = clear current slide
  const handleHide = async () => {
    if (hasTemporaryContent) {
      await clearTemporary.mutateAsync()
    } else {
      await clearSlide.mutateAsync()
    }
  }

  const hasContent = hasTemporaryContent || !!state?.lastSongSlideId

  // Render content button based on what's being presented
  const renderContentButton = () => {
    const temporaryContent = state?.temporaryContent
    if (!temporaryContent || isHidden) return null

    return <ContentTypeButton temporaryContent={temporaryContent} />
  }

  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <MonitorUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('presentation:controlRoom.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Screen Share Button - synced across all clients */}
          {screenShareState.isActive ? (
            <button
              type="button"
              onClick={handleStopScreenShare}
              className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors"
            >
              <MonitorOff className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t('presentation:controlRoom.screenShare.stop')}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartScreenShare}
              className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              <MonitorPlay className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t('presentation:controlRoom.screenShare.start')}
              </span>
            </button>
          )}
          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t('presentation:controlRoom.settings.button')}
            </span>
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 shrink-0 gap-4">
          {/* LEFT: Content Button */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {renderContentButton()}
          </div>

          {/* RIGHT: LIVE + Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* LIVE Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                !isHidden
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  !isHidden
                    ? 'bg-red-500 animate-pulse'
                    : 'bg-gray-400 dark:bg-gray-500'
                }`}
              />
              <span
                className={`text-xs font-semibold ${
                  !isHidden
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                LIVE
              </span>
            </div>
            {/* Clear Highlights Button */}
            {hasHighlights && (
              <button
                type="button"
                onClick={() => clearHighlights.mutate()}
                disabled={clearHighlights.isPending}
                className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                title={t('presentation:controls.clearHighlights')}
              >
                {clearHighlights.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Eraser size={16} />
                )}
              </button>
            )}
            {/* Hide/Show Button */}
            {!isHidden ? (
              <button
                type="button"
                onClick={handleHide}
                disabled={clearSlide.isPending || clearTemporary.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                title={`${t('presentation:controls.hide')} (Esc)`}
              >
                {clearSlide.isPending || clearTemporary.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <EyeOff size={18} />
                )}
                <span>{t('presentation:controls.hide')}</span>
                <span className="text-xs opacity-75">(Esc)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleShow}
                disabled={!hasContent || showSlideCommand.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                title={t('presentation:controls.show')}
              >
                {showSlideCommand.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Eye size={18} />
                )}
                <span>{t('presentation:controls.show')}</span>
                {showSlideShortcut && (
                  <span className="text-xs opacity-75">
                    ({formatShortcutForDisplay(showSlideShortcut)})
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center">
            <LivePreview />
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <ControlRoomSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}
