import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarPlus,
  GripVertical,
  Loader2,
  Pencil,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
import { AddSongToScheduleModal } from '~/features/schedules'
import { SongControlPanel, SongSlidesPanel } from '~/features/songs/components'
import { useSong, useSongKeyboardShortcuts } from '~/features/songs/hooks'
import type { SongSlide } from '~/features/songs/types'

export const Route = createFileRoute('/songs/$songId/')({
  component: SongPreviewPage,
  beforeLoad: ({ params }) => {
    // Redirect "new" to the edit page
    if (params.songId === 'new') {
      throw redirect({ to: '/songs/$songId/edit', params: { songId: 'new' } })
    }
  },
})

function SongPreviewPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()
  const { songId } = Route.useParams()
  const numericId = parseInt(songId, 10)

  const { data: song, isLoading } = useSong(numericId)
  const presentTemporarySong = usePresentTemporarySong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { data: presentationState } = usePresentationState()

  const [dividerPosition, setDividerPosition] = useState(40)
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Track screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Get the currently presented slide index from presentation state
  const presentedSlideIndex =
    presentationState?.temporaryContent?.type === 'song' &&
    presentationState.temporaryContent.data.songId === numericId
      ? presentationState.temporaryContent.data.currentSlideIndex
      : null

  const handleSlideClick = useCallback(
    async (_slide: SongSlide, index: number) => {
      // If clicking the currently presented slide, navigate back to songs list
      if (presentedSlideIndex === index) {
        navigate({ to: '/songs/', search: { fromSong: true } })
        return
      }
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
    },
    [numericId, presentTemporarySong, presentedSlideIndex, navigate],
  )

  const handleGoBack = useCallback(() => {
    navigate({ to: '/songs/' })
  }, [navigate])

  const handlePrevSlide = useCallback(async () => {
    if (presentedSlideIndex !== null && presentedSlideIndex > 0) {
      await navigateTemporary.mutateAsync({ direction: 'prev' })
    }
  }, [presentedSlideIndex, navigateTemporary])

  const handleNextSlide = useCallback(async () => {
    // Allow navigation even on last slide - server will end presentation
    if (presentedSlideIndex !== null) {
      await navigateTemporary.mutateAsync({ direction: 'next' })
    }
  }, [presentedSlideIndex, navigateTemporary])

  const handleHidePresentation = useCallback(async () => {
    await clearTemporary.mutateAsync()
  }, [clearTemporary])

  const handleEdit = useCallback(() => {
    navigate({ to: '/songs/$songId/edit', params: { songId } })
  }, [navigate, songId])

  const handleSongAddedToSchedule = useCallback(
    (scheduleId: number) => {
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(scheduleId) },
      })
    },
    [navigate],
  )

  // Keyboard shortcuts
  useSongKeyboardShortcuts({
    onNextSlide: handleNextSlide,
    onPreviousSlide: handlePrevSlide,
    onHidePresentation: handleHidePresentation,
    enabled: presentedSlideIndex !== null,
  })

  // Divider drag handlers
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newPosition =
        ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100
      setDividerPosition(Math.min(80, Math.max(20, newPosition)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  if (isLoading || !song) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  const canNavigatePrev =
    presentedSlideIndex !== null && presentedSlideIndex > 0
  // Allow navigating next even on last slide - server will end presentation
  const canNavigateNext = presentedSlideIndex !== null

  return (
    <div className="flex flex-col h-full lg:overflow-hidden overflow-auto scrollbar-thin">
      {/* Header - Back button and title, action buttons on desktop */}
      <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 lg:gap-4">
          <button
            type="button"
            onClick={handleGoBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            {song.title}
          </h1>
        </div>
        {/* Action buttons - hidden on mobile, shown in header on desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddToScheduleModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title={t('actions.addToSchedule')}
          >
            <CalendarPlus size={20} />
            <span>{t('actions.addToSchedule')}</span>
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Pencil size={16} />
            <span>{t('preview.edit')}</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:gap-0"
      >
        {/* Left Panel - Slides List (shows last on mobile) */}
        <div
          className="order-3 lg:order-1 lg:min-h-0 lg:h-full lg:flex-initial overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 lg:p-4"
          style={isLargeScreen ? { width: `${dividerPosition}%` } : undefined}
        >
          <SongSlidesPanel
            song={song}
            presentedSlideIndex={presentedSlideIndex}
            isLoading={isLoading}
            onSlideClick={handleSlideClick}
          />
        </div>

        {/* Draggable Divider */}
        <div
          className="hidden lg:flex items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
          onMouseDown={handleDividerMouseDown}
        >
          <GripVertical
            size={16}
            className="text-gray-400 group-hover:text-indigo-500 transition-colors"
          />
        </div>

        {/* Right Panel - Control Panel with Preview (shows first on mobile) */}
        <div
          className="order-1 lg:order-2 lg:min-h-0 lg:flex-1 overflow-hidden"
          style={isLargeScreen ? { width: `${100 - dividerPosition}%` } : undefined}
        >
          <SongControlPanel
            songId={numericId}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext}
          />
        </div>

        {/* Action buttons - shown on mobile only, below presentation */}
        <div className="order-2 lg:hidden flex items-center justify-center gap-2 py-2">
          <button
            type="button"
            onClick={() => setShowAddToScheduleModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title={t('actions.addToSchedule')}
          >
            <CalendarPlus size={18} />
            <span className="text-sm">{t('actions.addToSchedule')}</span>
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Pencil size={16} />
            <span>{t('preview.edit')}</span>
          </button>
        </div>
      </div>

      <AddSongToScheduleModal
        isOpen={showAddToScheduleModal}
        songId={numericId}
        onClose={() => setShowAddToScheduleModal(false)}
        onAdded={handleSongAddedToSchedule}
      />
    </div>
  )
}
