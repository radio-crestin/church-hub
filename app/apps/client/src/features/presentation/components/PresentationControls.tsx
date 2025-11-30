import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MonitorOff,
  Play,
  Square,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  useClearSlide,
  useNavigateSlide,
  usePresentationState,
  useStartPresentation,
  useStopPresentation,
  useWebSocket,
} from '../hooks'

interface PresentationControlsProps {
  programId?: number
  onStartPresentation?: () => void
}

export function PresentationControls({
  programId,
  onStartPresentation,
}: PresentationControlsProps) {
  const { t } = useTranslation('presentation')

  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: state, isLoading } = usePresentationState()
  const startPresentation = useStartPresentation()
  const stopPresentation = useStopPresentation()
  const navigateSlide = useNavigateSlide()
  const clearSlide = useClearSlide()

  const isPresenting = state?.isPresenting ?? false
  const hasCurrentSlide = !!state?.currentSlideId

  const handleStart = async () => {
    if (programId) {
      await startPresentation.mutateAsync(programId)
      onStartPresentation?.()
    }
  }

  const handleStop = async () => {
    await stopPresentation.mutateAsync()
  }

  const handlePrev = async () => {
    await navigateSlide.mutateAsync({ direction: 'prev' })
  }

  const handleNext = async () => {
    await navigateSlide.mutateAsync({ direction: 'next' })
  }

  const handleClear = async () => {
    await clearSlide.mutateAsync()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Start/Stop Button */}
      {isPresenting ? (
        <button
          type="button"
          onClick={handleStop}
          disabled={stopPresentation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          title={t('controls.stop')}
        >
          {stopPresentation.isPending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Square size={20} />
          )}
          <span className="hidden sm:inline">{t('controls.stop')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={!programId || startPresentation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          title={t('controls.start')}
        >
          {startPresentation.isPending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Play size={20} />
          )}
          <span className="hidden sm:inline">{t('controls.start')}</span>
        </button>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-2 ml-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!isPresenting || navigateSlide.isPending}
          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          title={t('controls.prev')}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!isPresenting || navigateSlide.isPending}
          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          title={t('controls.next')}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Clear Slide Button */}
      <button
        type="button"
        onClick={handleClear}
        disabled={!hasCurrentSlide || clearSlide.isPending}
        className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        title={t('controls.clear')}
      >
        <MonitorOff size={20} />
      </button>
    </div>
  )
}
