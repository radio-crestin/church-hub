import { ExternalLink, Loader2, MonitorUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useProgram, usePrograms } from '~/features/programs/hooks'
import { PresentationControls } from './PresentationControls'
import { SlidePreview } from './SlidePreview'
import {
  useDisplays,
  useKeyboardShortcuts,
  useNavigateSlide,
  usePresentationState,
  useWebSocket,
} from '../hooks'

export function ControlRoom() {
  const { t } = useTranslation('presentation')

  // Connect to WebSocket for real-time updates
  const { status: wsStatus } = useWebSocket()

  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  const { data: state } = usePresentationState()
  const { data: programs, isLoading: programsLoading } = usePrograms()
  const { data: displays } = useDisplays()
  const navigateSlide = useNavigateSlide()

  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    null,
  )

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

  const handleSlideClick = async (slideId: number) => {
    await navigateSlide.mutateAsync({ direction: 'goto', slideId })
  }

  const openDisplayWindow = (displayId: number) => {
    const width = 1280
    const height = 720
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    window.open(
      `/display/${displayId}`,
      `display-${displayId}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    )
  }

  if (programsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <MonitorUp size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('controlRoom.title')}
          </h1>
        </div>

        {/* Controls and Program Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Program Selector */}
          <select
            value={selectedProgramId ?? ''}
            onChange={(e) => setSelectedProgramId(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
          >
            <option value="" disabled>
              {t('controlRoom.selectProgram')}
            </option>
            {programs?.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>

          {/* Presentation Controls */}
          <PresentationControls programId={selectedProgramId ?? undefined} />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${
                state?.isPresenting ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {state?.isPresenting
                ? t('controlRoom.presenting')
                : t('controlRoom.notPresenting')}
            </span>
            {/* WebSocket Status */}
            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-600 pl-4">
              <div
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-green-500'
                    : wsStatus === 'connecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {wsStatus === 'connected'
                  ? t('controlRoom.connected')
                  : wsStatus === 'connecting'
                    ? t('controlRoom.connecting')
                    : t('controlRoom.disconnected')}
              </span>
            </div>
            {selectedProgram && (
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedProgram.name}
              </span>
            )}
          </div>

          {/* Quick Display Launchers */}
          {displays && displays.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('controlRoom.openDisplay')}:
              </span>
              {displays
                .filter((d) => d.isActive)
                .map((display) => (
                  <button
                    key={display.id}
                    type="button"
                    onClick={() => openDisplayWindow(display.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <ExternalLink size={12} />
                    {display.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Slides Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('controlRoom.slides')}
        </h2>

        {programLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : selectedProgram?.slides && selectedProgram.slides.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectedProgram.slides.map((slide) => (
              <SlidePreview
                key={slide.id}
                slide={slide}
                isActive={state?.currentSlideId === slide.id}
                onClick={() => handleSlideClick(slide.id)}
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
  )
}
