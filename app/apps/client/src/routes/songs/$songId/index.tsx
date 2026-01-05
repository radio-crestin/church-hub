import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarPlus,
  Download,
  GripVertical,
  Loader2,
  Pencil,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  clearSectionLastVisited,
  setSongsLastVisited,
} from '~/features/navigation'
import {
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
import { AddSongToScheduleModal } from '~/features/schedules'
import {
  type ExportFormat,
  ExportFormatModal,
  useSaveSongToFile,
} from '~/features/song-export'
import { SongControlPanel, SongSlidesPanel } from '~/features/songs/components'
import { useSong, useSongKeyboardShortcuts } from '~/features/songs/hooks'
import type { SongSlide } from '~/features/songs/types'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { useToast } from '~/ui/toast'

interface SongSearchParams {
  q?: string
}

export const Route = createFileRoute('/songs/$songId/')({
  component: SongPreviewPage,
  validateSearch: (search: Record<string, unknown>): SongSearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
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
  const { q: searchQuery } = useSearch({ from: '/songs/$songId/' })
  const numericId = parseInt(songId, 10)

  const { data: song, isLoading, isError } = useSong(numericId)
  const presentTemporarySong = usePresentTemporarySong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { data: presentationState } = usePresentationState()
  const { saveSong, isPending: isSaving } = useSaveSongToFile()
  const { showToast } = useToast()

  const [dividerPosition, setDividerPosition] = useState(40)
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [showExportFormatModal, setShowExportFormatModal] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Get expanded slides count for navigation bounds
  const expandedSlidesCount = useMemo(
    () => (song ? expandSongSlidesWithChoruses(song.slides).length : 0),
    [song],
  )

  // Handle song not found - redirect to search with toast
  useEffect(() => {
    if (!isLoading && (!song || isError)) {
      // Clear last visited to prevent navigation loop
      clearSectionLastVisited('songs')
      showToast(t('messages.notFound'), 'error')
      navigate({
        to: '/songs/',
        search: { fromSong: true, q: searchQuery || undefined },
      })
    }
  }, [isLoading, song, isError, showToast, t, navigate, searchQuery])

  // Save last visited song to localStorage
  useEffect(() => {
    if (song && !isLoading) {
      setSongsLastVisited({ songId: numericId })
    }
  }, [song, isLoading, numericId])

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
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
    },
    [numericId, presentTemporarySong],
  )

  const handleGoBack = useCallback(() => {
    // Clear last visited so user stays on list when going back
    clearSectionLastVisited('songs')
    // Always pass fromSong: true to prevent auto-redirect to presented song
    // Preserve search query so user returns to their search results
    navigate({
      to: '/songs/',
      search: { fromSong: true, q: searchQuery || undefined },
    })
  }, [navigate, searchQuery])

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

  const handleOpenExportModal = useCallback(() => {
    setShowExportFormatModal(true)
  }, [])

  const handleExportFormatConfirm = useCallback(
    async (format: ExportFormat) => {
      setShowExportFormatModal(false)
      if (!song) return

      const result = await saveSong(song, format)
      if (result.success) {
        showToast(t('messages.savedToFile'), 'success')
      } else if (result.error) {
        showToast(result.error, 'error')
      }
    },
    [song, saveSong, showToast, t],
  )

  // Present the selected slide
  const handlePresentSelectedSlide = useCallback(async () => {
    if (
      song &&
      selectedSlideIndex >= 0 &&
      selectedSlideIndex < expandedSlidesCount
    ) {
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: selectedSlideIndex,
      })
    }
  }, [
    song,
    selectedSlideIndex,
    expandedSlidesCount,
    presentTemporarySong,
    numericId,
  ])

  // Keyboard shortcuts for when a slide is presented
  useSongKeyboardShortcuts({
    onNextSlide: handleNextSlide,
    onPreviousSlide: handlePrevSlide,
    onHidePresentation: handleHidePresentation,
    enabled: presentedSlideIndex !== null,
  })

  // Keyboard navigation for slide selection when nothing is presented
  useEffect(() => {
    if (presentedSlideIndex !== null || expandedSlidesCount === 0) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or editor
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Don't trigger if user is in a contenteditable element
      if (
        event.target instanceof HTMLElement &&
        event.target.isContentEditable
      ) {
        return
      }

      // Don't trigger if any dialog/modal is open
      const openDialog = document.querySelector('dialog[open]')
      if (openDialog) {
        return
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          setSelectedSlideIndex((prev) =>
            prev < expandedSlidesCount - 1 ? prev + 1 : prev,
          )
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          setSelectedSlideIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break

        case 'Enter':
          event.preventDefault()
          handlePresentSelectedSlide()
          break

        case 'Escape':
          event.preventDefault()
          handleGoBack()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    presentedSlideIndex,
    expandedSlidesCount,
    handlePresentSelectedSlide,
    handleGoBack,
  ])

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
      {/* Header - Back button, title, and action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 lg:gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleGoBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {song.title}
          </h1>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={handleOpenExportModal}
            disabled={isSaving}
            className="p-2 sm:px-4 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            title={t('actions.saveToFile')}
          >
            <Download size={20} />
            <span className="hidden sm:inline">{t('actions.saveToFile')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddToScheduleModal(true)}
            className="p-2 sm:px-4 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center gap-2"
            title={t('actions.addToSchedule')}
          >
            <CalendarPlus size={20} />
            <span className="hidden sm:inline">
              {t('actions.addToSchedule')}
            </span>
          </button>
          <button
            type="button"
            onClick={handleEdit}
            className="p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-2"
            title={t('preview.edit')}
          >
            <Pencil size={16} />
            <span className="hidden sm:inline">{t('preview.edit')}</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:gap-1"
      >
        {/* Left Panel - Slides List (shows last on mobile) */}
        <div
          className="order-2 lg:order-1 lg:min-h-0 lg:h-full lg:flex-initial overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 lg:p-4"
          style={
            isLargeScreen
              ? { width: `calc(${dividerPosition}% - 8px)` }
              : undefined
          }
        >
          <SongSlidesPanel
            song={song}
            presentedSlideIndex={presentedSlideIndex}
            selectedSlideIndex={selectedSlideIndex}
            isLoading={isLoading}
            onSlideClick={handleSlideClick}
          />
        </div>

        {/* Draggable Divider */}
        <div
          className="hidden lg:flex lg:order-2 items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
          onMouseDown={handleDividerMouseDown}
        >
          <GripVertical
            size={16}
            className="text-gray-400 group-hover:text-indigo-500 transition-colors"
          />
        </div>

        {/* Right Panel - Control Panel with Preview (shows first on mobile) */}
        <div
          className="order-1 lg:order-3 lg:min-h-0 lg:flex-1 overflow-hidden shrink-0"
          style={
            isLargeScreen
              ? { width: `calc(${100 - dividerPosition}% - 8px)` }
              : undefined
          }
        >
          <SongControlPanel
            songId={numericId}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext}
          />
        </div>
      </div>

      <AddSongToScheduleModal
        isOpen={showAddToScheduleModal}
        songId={numericId}
        onClose={() => setShowAddToScheduleModal(false)}
        onAdded={handleSongAddedToSchedule}
      />

      <ExportFormatModal
        isOpen={showExportFormatModal}
        onConfirm={handleExportFormatConfirm}
        onCancel={() => setShowExportFormatModal(false)}
      />
    </div>
  )
}
