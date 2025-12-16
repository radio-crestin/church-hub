import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MonitorUp,
  Save,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'

import {
  AddToQueueMenu,
  InsertSlideModal,
  QueueList,
  SaveQueueAsScheduleModal,
  useClearQueue,
  useQueue,
} from '~/features/queue'
import type { SlideTemplate } from '~/features/queue/types'
import { SchedulePickerModal } from '~/features/schedules/components'
import { SongPickerModal } from '~/features/songs/components'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { LivePreview } from './LivePreview'
import {
  useClearSlide,
  useKeyboardShortcuts,
  useNavigateQueueSlide,
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
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [showSaveAsProgram, setShowSaveAsProgram] = useState(false)
  const navigate = useNavigate()

  const navigateQueueSlide = useNavigateQueueSlide()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()
  const updateState = useUpdatePresentationState()

  // Check if we have queue content
  const hasQueueSlide =
    !!state?.currentQueueItemId || !!state?.currentSongSlideId

  const handlePrev = async () => {
    await navigateQueueSlide.mutateAsync('prev')
  }

  const handleNext = async () => {
    await navigateQueueSlide.mutateAsync('next')
  }

  // Show = display the last slide
  const handleShow = async () => {
    // Check lastSongSlideId or currentQueueItemId
    if (state?.lastSongSlideId || state?.currentQueueItemId) {
      await showSlide.mutateAsync()
    }
  }

  // Hide = clear current slide (keep last slide for restoration)
  const handleHide = async () => {
    await clearSlide.mutateAsync()
  }

  // Handle slide click from queue - update presentation state
  const handleSlideClick = async (queueItemId: number, slideId: number) => {
    // slideId of -1 indicates a standalone slide (or Bible verse)
    const isStandaloneSlide = slideId === -1
    await updateState.mutateAsync({
      currentQueueItemId: queueItemId,
      currentSongSlideId: isStandaloneSlide ? null : slideId,
      isHidden: false,
    })
  }

  const handleClearConfirm = async () => {
    setShowClearModal(false)
    // Hide the presentation when clearing the queue
    await clearSlide.mutateAsync()
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

  const handleImportSchedule = () => {
    setShowSchedulePicker(true)
  }

  const handleScheduleSaved = (scheduleId: number) => {
    navigate({ to: '/schedules/$scheduleId', params: { scheduleId: String(scheduleId) } })
  }

  // Use isHidden flag for button state
  const isHidden = state?.isHidden ?? false
  // Check if we have content to show (for enabling show button)
  const hasContent =
    !!state?.currentSongSlideId ||
    !!state?.currentQueueItemId ||
    !!state?.lastSongSlideId
  const canNavigate = hasQueueSlide
  const isNavigating = navigateQueueSlide.isPending

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Main Content: Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
        {/* Left Column: Preview + Controls */}
        <div className="lg:w-2/3 space-y-3 overflow-auto">
          {/* Live Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MonitorUp size={20} className="text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('presentation:controlRoom.title')}
                </h2>
              </div>
              {/* Show/Hide Button */}
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
                {!isHidden ? (
                  <button
                    type="button"
                    onClick={handleHide}
                    disabled={clearSlide.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    title={`${t('presentation:controls.hide')} (Esc)`}
                  >
                    {clearSlide.isPending ? (
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
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Queue Header */}
            <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0">
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
                  onImportSchedule={handleImportSchedule}
                />
                {queue && queue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSaveAsProgram(true)}
                    className="p-1.5 text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg transition-colors"
                    title={t('queue:actions.saveAsProgram')}
                  >
                    <Save size={18} />
                  </button>
                )}
                {queue && queue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="p-1.5 text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 px-4 pb-4">
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

      {/* Schedule Picker Modal */}
      <SchedulePickerModal
        isOpen={showSchedulePicker}
        onClose={() => setShowSchedulePicker(false)}
      />

      {/* Save Queue as Schedule Modal */}
      <SaveQueueAsScheduleModal
        isOpen={showSaveAsProgram}
        onClose={() => setShowSaveAsProgram(false)}
        onSaved={handleScheduleSaved}
      />
    </div>
  )
}
