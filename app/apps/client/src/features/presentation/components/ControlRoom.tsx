import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MonitorUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SlideEditorModal } from '~/features/programs/components/SlideEditorModal'
import { useProgram, usePrograms } from '~/features/programs/hooks'
import type { Slide } from '~/features/programs/types'
import { LivePreview } from './LivePreview'
import { SlidePreview } from './SlidePreview'
import {
  useClearSlide,
  useKeyboardShortcuts,
  useNavigateSlide,
  usePresentationState,
  useShowSlide,
  useStartPresentation,
  useUpdatePresentationState,
  useWebSocket,
} from '../hooks'

export function ControlRoom() {
  const { t } = useTranslation('presentation')

  // Connect to WebSocket for real-time updates
  useWebSocket()

  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  const { data: state } = usePresentationState()
  const { data: programs, isLoading: programsLoading } = usePrograms()

  const navigateSlide = useNavigateSlide()
  const startPresentation = useStartPresentation()
  const clearSlide = useClearSlide()
  const showSlide = useShowSlide()
  const updateState = useUpdatePresentationState()

  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    null,
  )
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  // Set initial program from presentation state or first available
  useEffect(() => {
    if (state?.programId) {
      setSelectedProgramId(state.programId)
    } else if (programs?.length && !selectedProgramId) {
      setSelectedProgramId(programs[0].id)
    }
  }, [state?.programId, programs, selectedProgramId])

  const { data: selectedProgram, isLoading: programLoading } = useProgram(
    selectedProgramId ?? 0,
  )

  // Click on slide = select it, only display if currently showing
  const handleSlideClick = async (slideId: number) => {
    // First start presentation if not started
    if (!state?.isPresenting && selectedProgramId) {
      await startPresentation.mutateAsync(selectedProgramId)
    }

    // If currently showing content, navigate to display the slide
    // If hidden, only select it (update lastSlideId) without displaying
    if (state?.currentSlideId) {
      await navigateSlide.mutateAsync({ direction: 'goto', slideId })
    } else {
      // Just select the slide without displaying
      await updateState.mutateAsync({ lastSlideId: slideId })
    }
  }

  const handlePrev = async () => {
    await navigateSlide.mutateAsync({ direction: 'prev' })
  }

  const handleNext = async () => {
    await navigateSlide.mutateAsync({ direction: 'next' })
  }

  // Show = display the last slide (or start presentation with first slide)
  const handleShow = async () => {
    if (state?.lastSlideId) {
      await showSlide.mutateAsync()
    } else if (selectedProgramId) {
      // If no last slide, start presentation
      await startPresentation.mutateAsync(selectedProgramId)
    }
  }

  // Hide = clear current slide (keep last slide for restoration)
  const handleHide = async () => {
    await clearSlide.mutateAsync()
  }

  // Quick edit slide
  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide)
    setIsEditorOpen(true)
  }

  const handleCloseEditor = () => {
    setIsEditorOpen(false)
    setEditingSlide(null)
  }

  // After saving, display the edited slide
  const handleSaveSlide = async (savedSlide: Slide) => {
    // Start presentation if not started
    if (!state?.isPresenting && selectedProgramId) {
      await startPresentation.mutateAsync(selectedProgramId)
    }
    // Navigate to the saved slide to display it
    await navigateSlide.mutateAsync({
      direction: 'goto',
      slideId: savedSlide.id,
    })
  }

  const hasCurrentSlide = !!state?.currentSlideId
  const hasLastSlide = !!state?.lastSlideId
  const canShow = !hasCurrentSlide && (hasLastSlide || selectedProgramId)
  const canNavigate = state?.isPresenting

  if (programsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <MonitorUp size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('controlRoom.title')}
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
              title={t('controls.hide')}
            >
              {clearSlide.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <EyeOff size={20} />
              )}
              <span>{t('controls.hide')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleShow}
              disabled={!canShow || showSlide.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              title={t('controls.show')}
            >
              {showSlide.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Eye size={20} />
              )}
              <span>{t('controls.show')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Column: Preview + Controls */}
        <div className="lg:w-2/3 space-y-4">
          {/* Live Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('controlRoom.preview')}
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
                disabled={!canNavigate || navigateSlide.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                title={t('controls.prev')}
              >
                <ChevronLeft size={20} />
                <span>{t('controls.prev')}</span>
              </button>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNavigate || navigateSlide.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                title={t('controls.next')}
              >
                <span>{t('controls.next')}</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Slide List */}
        <div className="lg:w-1/3">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('controlRoom.slides')}
            </h2>

            {programLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : selectedProgram?.slides && selectedProgram.slides.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {selectedProgram.slides.map((slide) => (
                  <SlidePreview
                    key={slide.id}
                    slide={slide}
                    isActive={
                      (state?.currentSlideId ?? state?.lastSlideId) === slide.id
                    }
                    onClick={() => handleSlideClick(slide.id)}
                    onEdit={() => handleEditSlide(slide)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t('controlRoom.noSlides')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Edit Slide Modal */}
      {selectedProgramId && (
        <SlideEditorModal
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          onSave={handleSaveSlide}
          programId={selectedProgramId}
          slide={editingSlide}
        />
      )}
    </div>
  )
}
