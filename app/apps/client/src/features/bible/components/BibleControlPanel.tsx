import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Keyboard,
  Loader2,
  MonitorUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  LivePreview,
  useClearSlide,
  usePresentationState,
  useShowSlide,
  useWebSocket,
} from '~/features/presentation'

interface BibleControlPanelProps {
  onPrevVerse: () => void
  onNextVerse: () => void
  canNavigate: boolean
}

export function BibleControlPanel({
  onPrevVerse,
  onNextVerse,
  canNavigate,
}: BibleControlPanelProps) {
  const { t } = useTranslation('bible')

  useWebSocket()

  const { data: state } = usePresentationState()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()

  const isHidden = state?.isHidden ?? true
  const hasContent =
    !!state?.currentSongSlideId ||
    !!state?.currentQueueItemId ||
    !!state?.lastSongSlideId

  const handleShow = async () => {
    if (state?.lastSongSlideId || state?.currentQueueItemId) {
      await showSlide.mutateAsync()
    }
  }

  const handleHide = async () => {
    await clearSlide.mutateAsync()
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MonitorUp
            size={18}
            className="text-indigo-600 dark:text-indigo-400"
          />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('controls.title')}
          </h3>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="flex-1 p-3 space-y-3">
        <LivePreview />

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onPrevVerse}
            disabled={!canNavigate}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('controls.prevVerse')}
          >
            <ChevronUp size={18} />
            <span className="text-sm">{t('controls.prev')}</span>
          </button>

          {!isHidden ? (
            <button
              type="button"
              onClick={handleHide}
              disabled={clearSlide.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              title={`${t('controls.hide')} (Esc)`}
            >
              {clearSlide.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <EyeOff size={18} />
              )}
              <span className="text-sm">{t('controls.hide')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShow}
              disabled={!hasContent || showSlide.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              title={`${t('controls.show')} (F10)`}
            >
              {showSlide.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Eye size={18} />
              )}
              <span className="text-sm">{t('controls.show')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNextVerse}
            disabled={!canNavigate}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title={t('controls.nextVerse')}
          >
            <span className="text-sm">{t('controls.next')}</span>
            <ChevronDown size={18} />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Keyboard size={14} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('shortcuts.title')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">
                Up/Down
              </kbd>
              <span>{t('shortcuts.navigate')}</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">
                Left
              </kbd>
              <span>{t('shortcuts.back')}</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">
                Esc
              </kbd>
              <span>{t('shortcuts.hide')}</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">
                Enter
              </kbd>
              <span>{t('shortcuts.present')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
