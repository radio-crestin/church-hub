import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  History,
  Loader2,
  MonitorUp,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '~/features/keyboard-shortcuts'
import {
  LivePreview,
  useClearSlide,
  usePresentationState,
  useShowSlide,
  useWebSocket,
} from '~/features/presentation'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '~/features/presentation/hooks/useSlideHighlights'
import { KeyboardShortcutBadge } from '~/ui/kbd'

interface BibleControlPanelProps {
  onPrevVerse: () => void
  onNextVerse: () => void
  canNavigate: boolean
  onToggleHistory?: () => void
  isHistoryCollapsed?: boolean
}

export function BibleControlPanel({
  onPrevVerse,
  onNextVerse,
  canNavigate,
  onToggleHistory,
  isHistoryCollapsed,
}: BibleControlPanelProps) {
  const { t } = useTranslation('bible')

  useWebSocket()

  const { data: state } = usePresentationState()
  const clearSlide = useClearSlide()
  const showSlideCommand = useShowSlide()

  // Get configured showSlide shortcut for display
  const { shortcuts } = useAppShortcuts()
  const showSlideShortcut = useMemo(() => {
    const action = shortcuts.actions.showSlide
    return action?.enabled && action.shortcuts.length > 0
      ? action.shortcuts[0]
      : undefined
  }, [shortcuts])

  // Highlight management
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  const isHidden = state?.isHidden ?? true
  const hasContent =
    !!state?.currentSongSlideId ||
    !!state?.currentQueueItemId ||
    !!state?.lastSongSlideId

  const handleShow = async () => {
    if (state?.lastSongSlideId || state?.currentQueueItemId) {
      await showSlideCommand.mutateAsync()
    }
  }

  const handleHide = async () => {
    await clearSlide.mutateAsync()
  }

  return (
    <div className="flex flex-col lg:h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-2 lg:p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MonitorUp
            size={18}
            className="text-indigo-600 dark:text-indigo-400"
          />
          <h3 className="font-medium text-gray-900 dark:text-white text-sm lg:text-base">
            {t('controls.title')}
          </h3>
          {hasHighlights && (
            <button
              type="button"
              onClick={() => clearHighlights.mutate()}
              disabled={clearHighlights.isPending}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={t('controls.clearHighlights')}
            >
              {clearHighlights.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Eraser size={16} />
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggleHistory && (
            <button
              type="button"
              onClick={onToggleHistory}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={t('history.title')}
            >
              {isHistoryCollapsed ? (
                <PanelRightOpen size={16} />
              ) : (
                <PanelRightClose size={16} />
              )}
              <History size={14} />
            </button>
          )}
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
          {!isHidden ? (
            <button
              type="button"
              onClick={handleHide}
              disabled={clearSlide.isPending}
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={`${t('controls.hide')} (Esc)`}
            >
              {clearSlide.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <EyeOff size={18} />
              )}
              <span className="hidden sm:inline">{t('controls.hide')}</span>
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShow}
              disabled={!hasContent || showSlideCommand.isPending}
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={t('controls.show')}
            >
              {showSlideCommand.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Eye size={18} />
              )}
              <span className="hidden sm:inline">{t('controls.show')}</span>
              {showSlideShortcut && (
                <KeyboardShortcutBadge
                  shortcut={showSlideShortcut}
                  variant="muted"
                  className="hidden sm:inline-block"
                />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="p-2 lg:p-3 lg:flex-1 lg:min-h-0 flex flex-col">
        <div className="w-full flex-shrink-0">
          <LivePreview />
        </div>

        <div className="flex items-center justify-center gap-3 pt-3 flex-shrink-0">
          <button
            type="button"
            onClick={onPrevVerse}
            disabled={!canNavigate}
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('controls.prevVerse')}
          >
            <ChevronLeft size={20} />
            <span className="text-base">{t('controls.prev')}</span>
          </button>

          <button
            type="button"
            onClick={onNextVerse}
            disabled={!canNavigate}
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('controls.nextVerse')}
          >
            <span className="text-base">{t('controls.next')}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
