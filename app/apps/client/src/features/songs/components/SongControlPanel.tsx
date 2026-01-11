import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  ContentTypeButton,
  LivePreview,
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  useWebSocket,
} from '~/features/presentation'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from '~/features/presentation/hooks/useSlideHighlights'
import { KeyboardShortcutBadge } from '~/ui/kbd'

interface SongControlPanelProps {
  songId: number
  onPrevSlide: () => void
  onNextSlide: () => void
  canNavigatePrev: boolean
  canNavigateNext: boolean
}

export function SongControlPanel({
  songId,
  onPrevSlide,
  onNextSlide,
  canNavigatePrev,
  canNavigateNext,
}: SongControlPanelProps) {
  const { t } = useTranslation(['songs', 'bible'])

  useWebSocket()

  const { data: state } = usePresentationState()
  const clearTemporary = useClearTemporaryContent()
  const navigateTemporary = useNavigateTemporary()

  // Highlight management
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  // Check if this song is currently being presented
  const isTemporarySongActive =
    state?.temporaryContent?.type === 'song' &&
    state.temporaryContent.data.songId === songId

  const isHidden = state?.isHidden ?? true
  const isLive = !isHidden && isTemporarySongActive

  const handleHide = async () => {
    await clearTemporary.mutateAsync()
  }

  const handlePrev = async () => {
    if (isTemporarySongActive) {
      await navigateTemporary.mutateAsync({ direction: 'prev' })
    } else {
      onPrevSlide()
    }
  }

  const handleNext = async () => {
    if (isTemporarySongActive) {
      await navigateTemporary.mutateAsync({ direction: 'next' })
    } else {
      onNextSlide()
    }
  }

  return (
    <div className="flex flex-col lg:h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-2 lg:p-3 border-b border-gray-200 dark:border-gray-700">
        {/* Left side - Content type button and clear highlights */}
        <div className="flex items-center gap-2">
          {state?.temporaryContent && (
            <ContentTypeButton temporaryContent={state.temporaryContent} />
          )}
          {hasHighlights && (
            <button
              type="button"
              onClick={() => clearHighlights.mutate()}
              disabled={clearHighlights.isPending}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={t('bible:controls.clearHighlights')}
            >
              {clearHighlights.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Eraser size={16} />
              )}
            </button>
          )}
        </div>
        {/* Right side - LIVE indicator and controls */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
              isLive
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-gray-400 dark:bg-gray-500'
              }`}
            />
            <span
              className={`text-xs font-semibold ${
                isLive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              LIVE
            </span>
          </div>
          {isLive ? (
            <button
              type="button"
              onClick={handleHide}
              disabled={clearTemporary.isPending}
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title={`${t('bible:controls.hide')} (Esc)`}
            >
              {clearTemporary.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <EyeOff size={18} />
              )}
              <span className="hidden sm:inline">
                {t('bible:controls.hide')}
              </span>
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
            >
              <Eye size={18} />
              <span className="hidden sm:inline">
                {t('bible:controls.show')}
              </span>
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
            onClick={handlePrev}
            disabled={
              !canNavigatePrev ||
              navigateTemporary.isPending ||
              clearTemporary.isPending
            }
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('bible:controls.prev')}
          >
            <ChevronLeft size={20} />
            <span className="text-base">{t('bible:controls.prev')}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={
              !canNavigateNext ||
              navigateTemporary.isPending ||
              clearTemporary.isPending
            }
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('bible:controls.next')}
          >
            <span className="text-base">{t('bible:controls.next')}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
