import { Link } from '@tanstack/react-router'
import {
  Book,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MonitorUp,
  Music,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LivePreview } from './LivePreview'
import {
  useClearSlide,
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  useShowSlide,
  useWebSocket,
} from '../hooks'

export function ControlRoom() {
  const { t } = useTranslation(['presentation', 'common'])

  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: state } = usePresentationState()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()
  const clearTemporary = useClearTemporaryContent()
  const navigateTemporary = useNavigateTemporary()

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

  // Navigation within temporary content
  const handlePrev = async () => {
    if (hasTemporaryContent) {
      await navigateTemporary.mutateAsync({ direction: 'prev' })
    }
  }

  const handleNext = async () => {
    if (hasTemporaryContent) {
      await navigateTemporary.mutateAsync({ direction: 'next' })
    }
  }

  const canNavigate = hasTemporaryContent
  const hasContent = hasTemporaryContent || !!state?.lastSongSlideId

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Preview Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MonitorUp size={20} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('presentation:controlRoom.title')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
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

        <LivePreview />
      </div>

      {/* Navigation Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canNavigate || navigateTemporary.isPending}
            className="flex items-center gap-2 px-5 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-base"
            title={t('presentation:controls.prev')}
          >
            <ChevronLeft size={22} />
            <span>{t('presentation:controls.prev')}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canNavigate || navigateTemporary.isPending}
            className="flex items-center gap-2 px-5 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-base"
            title={t('presentation:controls.next')}
          >
            <span>{t('presentation:controls.next')}</span>
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t('presentation:controlRoom.quickLinks', 'Quick Links')}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/songs"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <Music size={18} />
            <span>{t('presentation:controlRoom.goToSongs', 'Songs')}</span>
          </Link>
          <Link
            to="/bible"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
          >
            <Book size={18} />
            <span>{t('presentation:controlRoom.goToBible', 'Bible')}</span>
          </Link>
          <Link
            to="/schedules"
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <Calendar size={18} />
            <span>
              {t('presentation:controlRoom.goToSchedules', 'Schedules')}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
