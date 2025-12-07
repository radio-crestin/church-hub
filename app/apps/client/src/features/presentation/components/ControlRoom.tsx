import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MonitorUp,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AddToQueueMenu,
  InsertSlideModal,
  QueueList,
  useClearQueue,
  useQueue,
} from '~/features/queue'
import type { SlideTemplate } from '~/features/queue/types'
import { SongPickerModal } from '~/features/songs/components'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { LivePreview } from './LivePreview'
import {
  useClearSlide,
  useKeyboardShortcuts,
  useNavigateQueueSlide,
  useNavigateSlide,
  usePresentationState,
  useShowSlide,
  useUpdatePresentationState,
  useWebSocket,
} from '../hooks'

export function ControlRoom() {
  const { t } = useTranslation(['presentation', 'queue'])
  const { showToast } = useToast()

  // Connect to WebSocket for real-time updates
  useWebSocket()

  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  const { data: state } = usePresentationState()
  const { data: queue } = useQueue()
  const clearQueueMutation = useClearQueue()
  const [showClearModal, setShowClearModal] = useState(false)
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [showSlideInsert, setShowSlideInsert] = useState(false)
  const [slideInsertTemplate, setSlideInsertTemplate] =
    useState<SlideTemplate>('announcement')

  const navigateSlide = useNavigateSlide()
  const navigateQueueSlide = useNavigateQueueSlide()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()
  const updateState = useUpdatePresentationState()

  // Determine if we're navigating queue slides or program slides
  const hasQueueSlide =
    !!state?.currentQueueItemId || !!state?.currentSongSlideId

  const handlePrev = async () => {
    if (hasQueueSlide) {
      await navigateQueueSlide.mutateAsync('prev')
    } else {
      await navigateSlide.mutateAsync({ direction: 'prev' })
    }
  }

  const handleNext = async () => {
    if (hasQueueSlide) {
      await navigateQueueSlide.mutateAsync('next')
    } else {
      await navigateSlide.mutateAsync({ direction: 'next' })
    }
  }

  // Show = display the last slide
  const handleShow = async () => {
    if (state?.lastSlideId || state?.currentSongSlideId) {
      await showSlide.mutateAsync()
    }
  }

  // Hide = clear current slide (keep last slide for restoration)
  const handleHide = async () => {
    await clearSlide.mutateAsync()
  }

  // Handle slide click from queue - update presentation state
  const handleSlideClick = async (queueItemId: number, slideId: number) => {
    // slideId of -1 indicates a standalone slide
    const isStandaloneSlide = slideId === -1
    await updateState.mutateAsync({
      currentQueueItemId: queueItemId,
      currentSongSlideId: isStandaloneSlide ? null : slideId,
    })
  }

  const handleClearConfirm = async () => {
    setShowClearModal(false)
    const success = await clearQueueMutation.mutateAsync()
    if (success) {
      showToast(t('queue:messages.cleared'), 'success')
    }
  }

  const handleAddSong = () => {
    setShowSongPicker(true)
  }

  const handleAddSlide = (template: SlideTemplate) => {
    setSlideInsertTemplate(template)
    setShowSlideInsert(true)
  }

  const hasCurrentSlide = !!state?.currentSlideId || !!state?.currentSongSlideId
  const hasLastSlide = !!state?.lastSlideId || !!state?.currentSongSlideId
  const canShow = !hasCurrentSlide && hasLastSlide
  const canNavigate = state?.isPresenting || hasQueueSlide
  const isNavigating = navigateSlide.isPending || navigateQueueSlide.isPending

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <MonitorUp size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('presentation:controlRoom.title')}
          </h1>
        </div>

        {/* Show/Hide */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Show/Hide Button - Green "Afiseaza" or Red "Ascunde" */}
          {hasCurrentSlide ? (
            <button
              type="button"
              onClick={handleHide}
              disabled={clearSlide.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              title={t('presentation:controls.hide')}
            >
              {clearSlide.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <EyeOff size={20} />
              )}
              <span>{t('presentation:controls.hide')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShow}
              disabled={!canShow || showSlide.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              title={t('presentation:controls.show')}
            >
              {showSlide.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Eye size={20} />
              )}
              <span>{t('presentation:controls.show')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Left Column: Preview + Controls */}
        <div className="lg:w-2/3 space-y-4 overflow-auto">
          {/* Live Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('presentation:controlRoom.preview')}
            </h2>
            <LivePreview />
          </div>

          {/* Navigation Controls Below Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {/* Previous Button */}
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canNavigate || isNavigating}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                title={t('presentation:controls.prev')}
              >
                <ChevronLeft size={20} />
                <span>{t('presentation:controls.prev')}</span>
              </button>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNavigate || isNavigating}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                title={t('presentation:controls.next')}
              >
                <span>{t('presentation:controls.next')}</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Queue List */}
        <div className="lg:w-1/3 flex flex-col min-h-0 flex-1 lg:flex-initial">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Queue Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('queue:title')}
                </h2>
                {queue && queue.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({t('queue:songCount', { count: queue.length })})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <AddToQueueMenu
                  onAddSong={handleAddSong}
                  onAddSlide={handleAddSlide}
                />
                {queue && queue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-md transition-colors"
                  >
                    <Trash2 size={14} />
                    {t('queue:actions.clear')}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 min-h-0">
              <QueueList
                activeSlideId={state?.currentSongSlideId ?? null}
                activeQueueItemId={state?.currentQueueItemId ?? null}
                onSlideClick={handleSlideClick}
                hideHeader
              />
            </div>
          </div>
        </div>
      </div>

      {/* Clear Queue Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        title={t('queue:confirmClear.title')}
        message={t('queue:confirmClear.message')}
        confirmLabel={t('queue:actions.clear')}
        cancelLabel={t('common:cancel')}
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearModal(false)}
        variant="danger"
      />

      {/* Song Picker Modal */}
      <SongPickerModal
        isOpen={showSongPicker}
        onClose={() => setShowSongPicker(false)}
      />

      {/* Insert Slide Modal */}
      <InsertSlideModal
        isOpen={showSlideInsert}
        onClose={() => setShowSlideInsert(false)}
        initialTemplate={slideInsertTemplate}
      />
    </div>
  )
}
