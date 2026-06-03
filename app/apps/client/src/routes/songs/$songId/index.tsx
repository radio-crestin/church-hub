import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Download,
  Eye,
  GripHorizontal,
  GripVertical,
  Loader2,
  Music,
  Music2,
  Pencil,
  Tag,
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
import {
  KeyLineEditDialog,
  type KeyLineEditDialogHandle,
} from '~/features/song-key'
import {
  CategoryEditDialog,
  type CategoryEditDialogHandle,
  SongBookmarksPanel,
  SongControlPanel,
  SongSlidesPanel,
  SongVersionsPanel,
} from '~/features/songs/components'
import {
  useAddBookmark,
  useRemoveBookmark,
  useResetPresentationCount,
  useSong,
  useSongBookmarks,
  useSongKeyboardShortcuts,
  useSongSlideSelectionKeyboard,
  useUndismissedSuggestionCount,
  useUpsertSong,
} from '~/features/songs/hooks'
import type { SongSlide } from '~/features/songs/types'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { useDividerPosition } from '~/hooks/useDividerPosition'
import { usePermissions } from '~/provider/permissions-provider'
import { DIVIDER_KEYS, SONG_DETAIL_DEFAULTS } from '~/service/layout'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'

interface SongSearchParams {
  q?: string
  reset?: number
  aiSearchId?: number
}

export const Route = createFileRoute('/songs/$songId/')({
  component: SongPreviewPage,
  validateSearch: (search: Record<string, unknown>): SongSearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    reset:
      typeof search.reset === 'number'
        ? search.reset
        : typeof search.reset === 'string'
          ? parseInt(search.reset, 10) || undefined
          : undefined,
    aiSearchId:
      typeof search.aiSearchId === 'number'
        ? search.aiSearchId
        : typeof search.aiSearchId === 'string'
          ? parseInt(search.aiSearchId, 10) || undefined
          : undefined,
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
  const { hasPermission } = usePermissions()
  const canEditSong = hasPermission('songs.edit')
  // `songs.create` covers "add a new linked version" — link an unrelated
  // song or accept a suggestion. View-only operators stay read-only;
  // editors get the full panel (add + set primary + unlink).
  const canAddSongVersion = hasPermission('songs.create')
  const { songId } = Route.useParams()
  const {
    q: searchQuery,
    reset,
    aiSearchId,
  } = useSearch({
    from: '/songs/$songId/',
  })

  // Handle reset from keyboard shortcut - redirect to song list with reset
  useEffect(() => {
    if (reset) {
      navigate({
        to: '/songs/',
        search: { reset, fromSong: true },
      })
    }
  }, [reset, navigate])
  const numericId = parseInt(songId, 10)

  const { data: song, isLoading, isError } = useSong(numericId)
  const presentTemporarySong = usePresentTemporarySong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { data: presentationState } = usePresentationState()
  const { saveSong, isPending: isSaving } = useSaveSongToFile()
  const resetPresentationCount = useResetPresentationCount()
  const upsertSong = useUpsertSong()
  const addBookmarkMutation = useAddBookmark()
  const removeBookmarkMutation = useRemoveBookmark()
  const { data: bookmarks = [] } = useSongBookmarks()
  const { showToast } = useToast()

  // Default layout: Slides 30% / Stage (Control Panel) 40% / Accordion 30%.
  // The Stage gets the biggest slice so the slide preview can breathe, and
  // Slides + Accordion start equal — the operator can drag from there.
  const [dividerPosition, setDividerPosition] = useDividerPosition(
    DIVIDER_KEYS.songDetailLeft,
    SONG_DETAIL_DEFAULTS.left,
  )
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [showAddBookmarksToScheduleModal, setShowAddBookmarksToScheduleModal] =
    useState(false)
  const [bookmarkSongIds, setBookmarkSongIds] = useState<number[]>([])
  const [showExportFormatModal, setShowExportFormatModal] = useState(false)
  const [showResetCountConfirm, setShowResetCountConfirm] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
  const [isEditMode, setIsEditMode] = useState(false)
  // Within the right-of-slides area, the Stage takes ~57% so that (combined
  // with the 30% Slides on the left) it lands at ~40% of the full page and
  // the Accordion at ~30% — matching Slides exactly.
  const [rightDividerPosition, setRightDividerPosition] = useDividerPosition(
    DIVIDER_KEYS.songDetailRight,
    SONG_DETAIL_DEFAULTS.right,
  )
  // Vertical split inside the right column between Marcaje (top) and Versiuni
  // (bottom). Default 50/50; only active when both sections are expanded.
  const [accordionDividerPosition, setAccordionDividerPosition] =
    useDividerPosition(DIVIDER_KEYS.songDetailAccordion, 50)
  // Right-column accordion state. Persisted across sessions via localStorage
  // so the operator's last choice (Versions vs Marcaje expanded) carries over
  // to the next song they open.
  const [bookmarksOpen, setBookmarksOpenRaw] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('song-detail:bookmarks-open')
      return raw === null ? true : raw === 'true'
    } catch {
      return true
    }
  })
  const [versionsOpen, setVersionsOpenRaw] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('song-detail:versions-open')
      return raw === null ? true : raw === 'true'
    } catch {
      return true
    }
  })
  const setBookmarksOpen = useCallback((next: boolean) => {
    setBookmarksOpenRaw(next)
    try {
      localStorage.setItem('song-detail:bookmarks-open', String(next))
    } catch {
      // Ignore quota errors — non-critical UI state.
    }
  }, [])
  const setVersionsOpen = useCallback((next: boolean) => {
    setVersionsOpenRaw(next)
    try {
      localStorage.setItem('song-detail:versions-open', String(next))
    } catch {
      // Ignore quota errors — non-critical UI state.
    }
  }, [])
  const [pendingExit, setPendingExit] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const accordionColumnRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const isRightDragging = useRef(false)
  const isAccordionDragging = useRef(false)
  const keyLineDialogRef = useRef<KeyLineEditDialogHandle>(null)
  const categoryDialogRef = useRef<CategoryEditDialogHandle>(null)

  // Drives the Versions accordion: the badge for unread suggestions and
  // the auto-expand on songs that have something new to look at.
  const undismissedSuggestionCount = useUndismissedSuggestionCount(numericId)

  // Auto-expand the Versions section when a freshly opened song has new
  // (undismissed) suggestions, so the operator can't miss them. Persists
  // ONLY across this session — we don't overwrite the user's global
  // "I collapsed Versions" preference; the next song without suggestions
  // will fall back to whatever's in localStorage.
  useEffect(() => {
    if (numericId && undismissedSuggestionCount > 0) {
      setVersionsOpenRaw(true)
    }
  }, [numericId, undismissedSuggestionCount])

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
      setSongsLastVisited({
        songId: numericId,
        searchQuery: searchQuery || undefined,
      })
    }
  }, [song, isLoading, numericId, searchQuery])

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
    // Clear last visited so returning from another page shows the list
    // (not the song we just navigated away from)
    clearSectionLastVisited('songs')

    navigate({
      to: '/songs/',
      search: {
        fromSong: true,
        q: searchQuery || undefined,
        selectedSongId: numericId,
        aiSearchId: aiSearchId || undefined,
      },
    })
  }, [navigate, searchQuery, numericId, aiSearchId])

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

  const isMutating = upsertSong.isPending

  const handleToggleEditMode = useCallback(() => {
    setPendingExit(false)
    setIsEditMode((prev) => !prev)
  }, [])

  const handleSave = useCallback(() => {
    // Force blur to trigger any pending slide edits before exiting
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    setPendingExit(true)
  }, [])

  // Exit edit mode after pending saves complete
  useEffect(() => {
    if (pendingExit && !isMutating) {
      setPendingExit(false)
      setIsEditMode(false)
    }
  }, [pendingExit, isMutating])

  const handleEditAsTextApply = useCallback(
    async (
      newSlides: Array<{
        id: string | number
        content: string
        sortOrder: number
        label?: string | null
      }>,
    ) => {
      if (!song) return
      await upsertSong.mutateAsync({
        id: numericId,
        title: song.title,
        slides: newSlides.map((s, i) => ({
          content: s.content,
          sortOrder: i,
          label: s.label ?? null,
        })),
      })
    },
    [song, upsertSong, numericId],
  )

  const isBookmarked = useMemo(
    () => bookmarks.some((b) => b.songId === numericId),
    [bookmarks, numericId],
  )

  const handleToggleBookmark = useCallback(() => {
    if (isBookmarked) {
      removeBookmarkMutation.mutate(numericId)
    } else {
      addBookmarkMutation.mutate(numericId)
    }
  }, [isBookmarked, numericId, addBookmarkMutation, removeBookmarkMutation])

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

  const handleOpenKeyLineDialog = useCallback(() => {
    if (song) {
      keyLineDialogRef.current?.open(song)
    }
  }, [song])

  const handleOpenCategoryDialog = useCallback(() => {
    if (song) {
      categoryDialogRef.current?.open(song)
    }
  }, [song])

  const handleResetPresentationCount = useCallback(async () => {
    if (!song) return
    setShowResetCountConfirm(false)
    await resetPresentationCount.mutateAsync(song.id)
    showToast(t('messages.presentationCountReset'), 'success')
  }, [song, resetPresentationCount, showToast, t])

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
  useSongSlideSelectionKeyboard({
    slidesCount: expandedSlidesCount,
    selectedSlideIndex,
    onSelectSlide: setSelectedSlideIndex,
    onPresentSlide: handlePresentSelectedSlide,
    onGoBack: handleGoBack,
    enabled: presentedSlideIndex === null,
  })

  // Divider drag handlers
  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [setDividerPosition],
  )

  const handleRightDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isRightDragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isRightDragging.current || !rightPanelRef.current) return
        const rect = rightPanelRef.current.getBoundingClientRect()
        const newPos = ((moveEvent.clientX - rect.left) / rect.width) * 100
        const clamped = Math.min(70, Math.max(20, newPos))
        setRightDividerPosition(clamped)
      }

      const handleMouseUp = () => {
        isRightDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setRightDividerPosition],
  )

  // Vertical (row) resize between the Marcaje and Versiuni sections of the
  // right column. Position is the % height given to Marcaje (the top section).
  const handleAccordionDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isAccordionDragging.current = true
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isAccordionDragging.current || !accordionColumnRef.current) return
        const rect = accordionColumnRef.current.getBoundingClientRect()
        const newPos = ((moveEvent.clientY - rect.top) / rect.height) * 100
        setAccordionDividerPosition(Math.min(80, Math.max(20, newPos)))
      }

      const handleMouseUp = () => {
        isAccordionDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setAccordionDividerPosition],
  )

  const handleBookmarkSongClick = useCallback(
    (bookmark: { songId: number }) => {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(bookmark.songId) },
        search: { q: searchQuery || undefined },
      })
    },
    [navigate, searchQuery],
  )

  const handleAddAllBookmarksToSchedule = useCallback((songIds: number[]) => {
    setBookmarkSongIds(songIds)
    setShowAddBookmarksToScheduleModal(true)
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

  // The Marcaje↔Versiuni divider only makes sense when both sections are
  // expanded and visible (Marcaje is hidden below `lg`). Otherwise the column
  // falls back to its flex behaviour (the open section grows, collapsed ones
  // shrink to their header).
  const accordionSplitActive =
    isLargeScreen && bookmarksOpen && versionsOpen && Boolean(song)

  return (
    <div className="flex flex-col h-full lg:overflow-hidden lg:h-[calc(100vh-3rem)] overflow-auto scrollbar-thin">
      {/* Header - Back button, title, and action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 lg:gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            <button
              type="button"
              onClick={handleGoBack}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0 flex items-center gap-2"
              title="Back (Esc)"
            >
              <ArrowLeft
                size={20}
                className="text-gray-600 dark:text-gray-400"
              />
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {song.title}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pl-1 md:pl-0">
            {song.category?.name && (
              <button
                type="button"
                onClick={handleOpenCategoryDialog}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('categoryDialog.title')}
              >
                <Tag className="w-3 h-3" />
                {song.category.name}
              </button>
            )}
            {song.presentationCount !== undefined &&
              song.presentationCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowResetCountConfirm(true)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded hover:bg-sky-200 dark:hover:bg-sky-800/40 transition-colors"
                  title={t('resetCountDialog.title')}
                >
                  <Eye className="w-3 h-3" />
                  {song.presentationCount}
                </button>
              )}
            {song.keyLine && (
              <button
                type="button"
                onClick={handleOpenKeyLineDialog}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors"
                title={t('actions.setKeyLine')}
              >
                <Music2 className="w-3 h-3" />
                {song.keyLine}
              </button>
            )}
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:justify-end shrink-0">
          <button
            type="button"
            onClick={handleToggleBookmark}
            className={`p-2 rounded-lg transition-colors inline-flex items-center justify-center ${
              isBookmarked
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
            title={isBookmarked ? t('bookmarks.remove') : t('bookmarks.add')}
          >
            {isBookmarked ? (
              <BookmarkCheck size={20} />
            ) : (
              <Bookmark size={20} />
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenKeyLineDialog}
            className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center justify-center"
            title={t('actions.setKeyLine')}
          >
            <Music size={20} />
          </button>
          <button
            type="button"
            onClick={handleOpenExportModal}
            disabled={isSaving}
            className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
            title={t('actions.saveToFile')}
          >
            <Download size={20} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddToScheduleModal(true)}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center justify-center"
            title={t('actions.addToSchedule')}
          >
            <CalendarPlus size={20} />
          </button>
          {canEditSong && (
            <button
              type="button"
              onClick={handleEdit}
              className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center justify-center"
              title={t('preview.edit')}
            >
              <Pencil size={20} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:gap-1"
      >
        {/* Left Panel - Slides List (shows last on mobile) */}
        <div
          className="order-2 lg:order-1 lg:min-h-0 lg:self-stretch lg:flex-initial overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 lg:relative"
          style={
            isLargeScreen
              ? { width: `calc(${dividerPosition}% - 8px)` }
              : undefined
          }
        >
          <div className="p-3 lg:p-4 lg:absolute lg:inset-0">
            <SongSlidesPanel
              song={song}
              presentedSlideIndex={presentedSlideIndex}
              selectedSlideIndex={selectedSlideIndex}
              isLoading={isLoading}
              isEditMode={isEditMode}
              onToggleEditMode={handleToggleEditMode}
              canEdit={canEditSong}
              onSave={handleSave}
              onSlideClick={handleSlideClick}
              isSaving={pendingExit || isMutating}
              onApplyText={handleEditAsTextApply}
            />
          </div>
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

        {/* Right Panel — Control alone in the middle column, the right
            column stacks Marcaje + Versiuni as collapsible sections so
            both stay visible by default and neither is hidden under a
            tab. The right divider only controls the Control vs accordion
            split; the accordion sections balance themselves via flex. */}
        <div
          ref={rightPanelRef}
          className="order-1 lg:order-3 lg:min-h-0 lg:flex-1 overflow-hidden shrink-0 flex flex-col lg:flex-row"
          style={
            isLargeScreen
              ? { width: `calc(${100 - dividerPosition}% - 8px)` }
              : undefined
          }
        >
          {/* Control Panel column (now owns the full height of its column). */}
          <div
            className="h-full overflow-hidden"
            style={
              isLargeScreen
                ? { width: `calc(${rightDividerPosition}% - 4px)` }
                : { flex: 1, minWidth: 0 }
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

          {/* Vertical Divider */}
          <div
            className="hidden lg:flex items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
            onMouseDown={handleRightDividerMouseDown}
          >
            <GripVertical
              size={16}
              className="text-gray-400 group-hover:text-indigo-500 transition-colors"
            />
          </div>

          {/* Accordion column — Marcaje on top, Versiuni below.
              Bookmarks were previously hidden on mobile (the page is
              too tight); we preserve that. Versions ride along on
              mobile because they were already visible there before. */}
          <div
            ref={accordionColumnRef}
            className={`overflow-hidden h-full flex flex-col ${accordionSplitActive ? '' : 'gap-2'}`}
            style={
              isLargeScreen
                ? { width: `calc(${100 - rightDividerPosition}% - 4px)` }
                : undefined
            }
          >
            <div
              className={`hidden lg:block min-h-0 ${
                accordionSplitActive
                  ? ''
                  : bookmarksOpen
                    ? 'flex-1'
                    : 'flex-none'
              }`}
              style={
                accordionSplitActive
                  ? { height: `calc(${accordionDividerPosition}% - 4px)` }
                  : undefined
              }
            >
              <SongBookmarksPanel
                onSelectSong={handleBookmarkSongClick}
                activeSongId={numericId}
                onAddAllToSchedule={handleAddAllBookmarksToSchedule}
                isCollapsed={!bookmarksOpen}
                onToggleCollapse={() => setBookmarksOpen(!bookmarksOpen)}
              />
            </div>

            {/* Draggable Marcaje ↔ Versiuni divider (only when both expanded) */}
            {accordionSplitActive ? (
              <div
                className="hidden lg:flex flex-col items-center justify-center h-2 cursor-row-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
                onMouseDown={handleAccordionDividerMouseDown}
              >
                <GripHorizontal
                  size={16}
                  className="text-gray-400 group-hover:text-indigo-500 transition-colors"
                />
              </div>
            ) : null}

            {song ? (
              <div
                className={`min-h-0 ${
                  accordionSplitActive
                    ? ''
                    : versionsOpen
                      ? 'flex-1'
                      : 'flex-none'
                }`}
                style={
                  accordionSplitActive
                    ? {
                        height: `calc(${100 - accordionDividerPosition}% - 4px)`,
                      }
                    : undefined
                }
              >
                <SongVersionsPanel
                  songId={numericId}
                  songTitle={song.title}
                  canAdd={canAddSongVersion}
                  canEdit={canEditSong}
                  isCollapsed={!versionsOpen}
                  onToggleCollapse={() => setVersionsOpen(!versionsOpen)}
                  attentionBadge={
                    undismissedSuggestionCount > 0
                      ? `+${undismissedSuggestionCount}`
                      : null
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AddSongToScheduleModal
        isOpen={showAddToScheduleModal}
        songId={numericId}
        onClose={() => setShowAddToScheduleModal(false)}
        onAdded={handleSongAddedToSchedule}
      />

      <AddSongToScheduleModal
        isOpen={showAddBookmarksToScheduleModal}
        songIds={bookmarkSongIds}
        onClose={() => setShowAddBookmarksToScheduleModal(false)}
      />

      <ExportFormatModal
        isOpen={showExportFormatModal}
        onConfirm={handleExportFormatConfirm}
        onCancel={() => setShowExportFormatModal(false)}
      />

      <KeyLineEditDialog ref={keyLineDialogRef} />
      <CategoryEditDialog ref={categoryDialogRef} />

      <ConfirmModal
        isOpen={showResetCountConfirm}
        title={t('resetCountDialog.title')}
        message={t('resetCountDialog.message')}
        confirmLabel={t('resetCountDialog.confirm')}
        onConfirm={handleResetPresentationCount}
        onCancel={() => setShowResetCountConfirm(false)}
      />
    </div>
  )
}
