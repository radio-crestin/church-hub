import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  Calendar,
  Eraser,
  Eye,
  EyeOff,
  Loader2,
  MonitorUp,
  Music,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ControlRoomSettingsModal } from './ControlRoomSettingsModal'
import { LivePreview } from './LivePreview'
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
import type { TemporaryContent } from '../types'

export function ControlRoom() {
  const { t } = useTranslation(['presentation', 'common'])
  const navigate = useNavigate()

  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: state } = usePresentationState()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()
  const clearTemporary = useClearTemporaryContent()

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
      await showSlide.mutateAsync()
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

  // Helper to get display label for content
  const getContentLabel = (content: TemporaryContent): string => {
    switch (content.type) {
      case 'song':
        return content.data.title
      case 'bible':
        return content.data.reference
      case 'bible_passage':
        return `${content.data.bookName} ${content.data.startChapter}:${content.data.startVerse}-${content.data.endChapter}:${content.data.endVerse}`
      case 'announcement':
        return t('presentation:contentTypes.announcement')
      case 'versete_tineri':
        return t('presentation:contentTypes.verseteTineri')
      case 'scene':
        return content.data.obsSceneName
      default:
        return ''
    }
  }

  // Render content button based on what's being presented
  const renderContentButton = () => {
    const temporaryContent = state?.temporaryContent
    if (!temporaryContent || isHidden) return null

    const buttonClassName =
      'flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline truncate transition-colors'

    // Check if item came from a schedule - if so, navigate to schedule
    const scheduleId = temporaryContent.data.scheduleId
    const scheduleItemIndex = temporaryContent.data.scheduleItemIndex

    if (scheduleId !== undefined && scheduleItemIndex !== undefined) {
      // Navigate to schedule with item selected
      return (
        <button
          type="button"
          onClick={() =>
            navigate({
              to: '/schedules/$scheduleId',
              params: { scheduleId: String(scheduleId) },
              search: { itemIndex: scheduleItemIndex },
            })
          }
          className={buttonClassName}
        >
          <Calendar size={16} className="shrink-0" />
          <span className="truncate">{getContentLabel(temporaryContent)}</span>
        </button>
      )
    }

    // Not from schedule - navigate to content source directly
    switch (temporaryContent.type) {
      case 'song': {
        const { songId, title } = temporaryContent.data
        return (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/songs/$songId',
                params: { songId: String(songId) },
              })
            }
            className={buttonClassName}
          >
            <Music size={16} className="shrink-0" />
            <span className="truncate">{title}</span>
          </button>
        )
      }

      case 'bible': {
        const { bookId, bookName, chapter, currentVerseIndex } =
          temporaryContent.data
        const verse = currentVerseIndex + 1
        return (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/bible',
                search: { book: bookId, bookName, chapter, verse },
              })
            }
            className={buttonClassName}
          >
            <BookOpen size={16} className="shrink-0" />
            <span className="truncate">{temporaryContent.data.reference}</span>
          </button>
        )
      }

      case 'bible_passage': {
        const { bookName, startChapter, startVerse, endChapter, endVerse } =
          temporaryContent.data
        return (
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/bible',
                search: { bookName, chapter: startChapter, verse: startVerse },
              })
            }
            className={buttonClassName}
          >
            <BookOpen size={16} className="shrink-0" />
            <span className="truncate">
              {bookName} {startChapter}:{startVerse}-{endChapter}:{endVerse}
            </span>
          </button>
        )
      }

      // versete_tineri, announcement, scene - no dedicated pages to navigate to
      default:
        return null
    }
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
                disabled={!hasContent || showSlide.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                title={`${t('presentation:controls.show')} (F10)`}
              >
                {showSlide.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Eye size={18} />
                )}
                <span>{t('presentation:controls.show')}</span>
                <span className="text-xs opacity-75">(F10)</span>
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
