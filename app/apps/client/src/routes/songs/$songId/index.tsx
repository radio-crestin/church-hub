import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { GripVertical, Loader2, Music, Pencil } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Get the currently presented slide index from presentation state
  const presentedSlideIndex =
    presentationState?.temporaryContent?.type === 'song' &&
    presentationState.temporaryContent.data.songId === numericId
      ? presentationState.temporaryContent.data.currentSlideIndex
      : null

  const handleSlideClick = useCallback(
    async (_slide: SongSlide, index: number) => {
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
    },
    [numericId, presentTemporarySong],
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

  // Keyboard shortcuts
  useSongKeyboardShortcuts({
    onNextSlide: handleNextSlide,
    onPreviousSlide: handlePrevSlide,
    onGoBack: handleGoBack,
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Music className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {t('title')}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleEdit}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <Pencil size={16} />
          <span>{t('preview.edit')}</span>
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex flex-col lg:flex-row flex-1 min-h-0"
      >
        {/* Left Panel - Slides List */}
        <div
          className="min-h-0 h-full flex-1 lg:flex-initial overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          style={{ width: `${dividerPosition}%` }}
        >
          <SongSlidesPanel
            song={song}
            presentedSlideIndex={presentedSlideIndex}
            isLoading={isLoading}
            onSlideClick={handleSlideClick}
            onGoBack={handleGoBack}
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

        {/* Right Panel - Control Panel with Preview */}
        <div
          className="min-h-0 flex-1 overflow-hidden"
          style={{ width: `${100 - dividerPosition}%` }}
        >
          <SongControlPanel
            songId={numericId}
            songTitle={song.title}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext}
          />
        </div>
      </div>
    </div>
  )
}
