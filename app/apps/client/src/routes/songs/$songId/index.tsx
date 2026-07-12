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
  GripVertical,
  Loader2,
  Music,
  Music2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Projector,
  Tag,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  clearSectionLastVisited,
  setSongsLastVisited,
} from '~/features/navigation'
import type { TemporaryContent } from '~/features/presentation'
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
  SongAccordionColumn,
  SongControlPanel,
  SongSlidesPanel,
  SongStageBoard,
} from '~/features/songs/components'
import {
  useAddBookmark,
  usePreviewMode,
  useRemoveBookmark,
  useResetPresentationCount,
  useSong,
  useSongBookmarks,
  useSongEditorLayout,
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
  const [editorLayout, setEditorLayout] = useSongEditorLayout()
  // Dedicated song-versions perms — split so an admin can grant view +
  // CRUD on versions independently of the song's CRUD rights. The boot-time
  // migration `add-song-versions-permissions` backfills these onto users
  // and roles that already had the equivalent `songs.{view|create|edit|delete}`,
  // so this gate is backward-compatible.
  const canViewSongVersions = hasPermission('song_versions.view')
  const canAddSongVersion = hasPermission('song_versions.create')
  const canEditSongVersion = hasPermission('song_versions.edit')
  const canDeleteSongVersion = hasPermission('song_versions.delete')
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
  // Preview mode (persisted globally): when ON, clicking a verse stages it in
  // the local stage instead of projecting. `stagedSlideIndex` is the slide
  // staged (indigo) but not yet projected.
  const { previewMode, togglePreviewMode } = usePreviewMode()
  const [stagedSlideIndex, setStagedSlideIndex] = useState<number | null>(null)
  // Within the right-of-slides area, the Stage takes ~57% so that (combined
  // with the 30% Slides on the left) it lands at ~40% of the full page and
  // the Accordion at ~30% — matching Slides exactly.
  const [rightDividerPosition, setRightDividerPosition] = useDividerPosition(
    DIVIDER_KEYS.songDetailRight,
    SONG_DETAIL_DEFAULTS.right,
  )
  // PowerPoint layout: the Stage board takes ~74% and the Marcaje/Versiuni
  // column the rest. Only applied on large screens; they stack on mobile.
  const [ppDividerPosition, setPpDividerPosition] = useDividerPosition(
    DIVIDER_KEYS.songDetailPowerpoint,
    74,
  )
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
  // Whether the entire right column (Marcaje + Versiuni) is shown. When hidden
  // the Control panel takes the full width of its area, leaving only a slim
  // rail to bring the column back. Desktop-only; persisted across sessions.
  const [accordionColumnVisible, setAccordionColumnVisibleRaw] =
    useState<boolean>(() => {
      try {
        const raw = localStorage.getItem('song-detail:accordion-column-visible')
        return raw === null ? true : raw === 'true'
      } catch {
        return true
      }
    })
  const setAccordionColumnVisible = useCallback((next: boolean) => {
    setAccordionColumnVisibleRaw(next)
    try {
      localStorage.setItem('song-detail:accordion-column-visible', String(next))
    } catch {
      // Ignore quota errors — non-critical UI state.
    }
  }, [])
  const [pendingExit, setPendingExit] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const ppContainerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const isRightDragging = useRef(false)
  const isPpDragging = useRef(false)
  const keyLineDialogRef = useRef<KeyLineEditDialogHandle>(null)
  const categoryDialogRef = useRef<CategoryEditDialogHandle>(null)

  // Feeds the Versions accordion's "+N" attention badge for unread suggestions.
  // We deliberately do NOT auto-expand the section on songs that have new
  // suggestions: the operator's collapsed/expanded choice is a persisted
  // preference that must carry across song navigation — the badge alone flags
  // that there's something new to look at, without fighting their choice.
  const undismissedSuggestionCount = useUndismissedSuggestionCount(numericId)

  // Expanded slides (with auto-inserted choruses) — used for navigation bounds
  // and to build the staged preview content faithfully (same shape the server
  // produces for a presented temporary song).
  const expandedSlides = useMemo(
    () => (song ? expandSongSlidesWithChoruses(song.slides) : []),
    [song],
  )
  const expandedSlidesCount = expandedSlides.length

  // The locally staged slide, shaped as temporary song content for the shared
  // presentation hook. Drives the stage (LivePreview) without projecting.
  const stagedPreviewContent = useMemo<TemporaryContent | null>(() => {
    if (
      !previewMode ||
      stagedSlideIndex === null ||
      !song ||
      stagedSlideIndex < 0 ||
      stagedSlideIndex >= expandedSlides.length
    ) {
      return null
    }
    return {
      type: 'song',
      data: {
        songId: song.id,
        title: song.title,
        keyLine: song.keyLine,
        slides: expandedSlides.map((s, idx) => ({
          id: s.id,
          content: s.content,
          chords: s.chords,
          sortOrder: idx,
        })),
        currentSlideIndex: stagedSlideIndex,
      },
    }
  }, [previewMode, stagedSlideIndex, song, expandedSlides])

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

  // Whether THIS song is the one currently being projected (live and visible).
  // While it is, a click drives the live projection (like the arrows); when a
  // different song is live (or nothing is), a click only stages locally.
  const isThisSongLive =
    presentedSlideIndex !== null && !(presentationState?.isHidden ?? true)

  // Default the staged slide whenever Preview mode turns on (or the song
  // changes while it's on) so the small stage immediately shows text: the live
  // slide if any, otherwise the selected one. Turning Preview off clears it.
  // Deliberately keyed only on previewMode/numericId (not the indices) so this
  // doesn't re-stage on every navigation — those are read as current values.
  useEffect(() => {
    if (!previewMode) {
      setStagedSlideIndex(null)
      return
    }
    setStagedSlideIndex(presentedSlideIndex ?? selectedSlideIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, numericId])

  const handleSlideClick = useCallback(
    async (_slide: SongSlide, index: number) => {
      // Preview mode: a single click only stages the slide locally — UNLESS
      // this song is the one currently being projected, in which case the click
      // also drives the live projection (so clicks behave like the arrows once
      // you're live on this song). A different song stays untouched on screen.
      if (previewMode && !isThisSongLive) {
        setStagedSlideIndex(index)
        return
      }
      setStagedSlideIndex(null)
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
    },
    [previewMode, isThisSongLive, numericId, presentTemporarySong],
  )

  // Preview mode: double-click projects the slide immediately. Keep the stage
  // showing it until the projection lands, then clear (live now mirrors it).
  const handleSlideProject = useCallback(
    async (_slide: SongSlide, index: number) => {
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
      setStagedSlideIndex(null)
    },
    [numericId, presentTemporarySong],
  )

  // Project the currently staged slide (Afișează button).
  const handleProjectStaged = useCallback(async () => {
    if (stagedSlideIndex === null) return
    await presentTemporarySong.mutateAsync({
      songId: numericId,
      slideIndex: stagedSlideIndex,
    })
    setStagedSlideIndex(null)
  }, [stagedSlideIndex, numericId, presentTemporarySong])

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
    // Don't gate on the client's (possibly-lagging) slide index — a fast
    // next→prev on a presenter remote would otherwise no-op because the local
    // index hasn't caught up yet. The server clamps prev at the first slide
    // (it never closes on prev), so this is safe.
    if (presentedSlideIndex !== null) {
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
    // With Preview mode on, keep the (previously) live slide staged so the
    // operator's small stage retains the text after the projection is hidden.
    if (previewMode && presentedSlideIndex !== null) {
      setStagedSlideIndex(presentedSlideIndex)
    }
    await clearTemporary.mutateAsync()
  }, [previewMode, presentedSlideIndex, clearTemporary])

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

  // In PowerPoint mode the stage board owns keyboard navigation (arrows must
  // move the canvas selection too), so the classic-page handlers stand down to
  // avoid double navigation on the shared keyboard registry.
  const classicKeyboard = editorLayout !== 'powerpoint'

  // Keyboard shortcuts for when a slide is presented
  useSongKeyboardShortcuts({
    onNextSlide: handleNextSlide,
    onPreviousSlide: handlePrevSlide,
    onHidePresentation: handleHidePresentation,
    enabled: classicKeyboard && presentedSlideIndex !== null,
  })

  // Keyboard navigation for slide selection when nothing is presented
  useSongSlideSelectionKeyboard({
    slidesCount: expandedSlidesCount,
    selectedSlideIndex,
    onSelectSlide: setSelectedSlideIndex,
    onPresentSlide: handlePresentSelectedSlide,
    onGoBack: handleGoBack,
    enabled: classicKeyboard && presentedSlideIndex === null,
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

  // PowerPoint layout: resize between the Stage board and the accordion column.
  const handlePpDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isPpDragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isPpDragging.current || !ppContainerRef.current) return
        const rect = ppContainerRef.current.getBoundingClientRect()
        const newPos = ((moveEvent.clientX - rect.left) / rect.width) * 100
        setPpDividerPosition(Math.min(85, Math.max(50, newPos)))
      }

      const handleMouseUp = () => {
        isPpDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setPpDividerPosition],
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

  // The right column can be hidden entirely on desktop to give the Slides and
  // Stage columns more room. On mobile it always renders (Versiuni is the only
  // visible section there).
  const showAccordionColumn = !isLargeScreen || accordionColumnVisible

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
                data-testid="song-key-button"
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
              onClick={() =>
                setEditorLayout(
                  editorLayout === 'powerpoint' ? 'normal' : 'powerpoint',
                )
              }
              className={`p-2 rounded-lg transition-colors inline-flex items-center justify-center ${
                editorLayout === 'powerpoint'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
              title={t('stageEditor.toggleLayout')}
              aria-pressed={editorLayout === 'powerpoint'}
            >
              <Projector size={20} />
            </button>
          )}
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

      {editorLayout === 'powerpoint' && song && canEditSong ? (
        /* PowerPoint layout: edit slides directly on the song page, with the
           same collapsible Marcaje/Versiuni column as the classic layout. */
        <div
          ref={ppContainerRef}
          className="flex flex-col lg:flex-row flex-1 min-h-0 gap-3 lg:gap-1"
        >
          <div
            className="order-1 flex min-w-0 min-h-0"
            style={
              isLargeScreen && showAccordionColumn
                ? { width: `calc(${ppDividerPosition}% - 8px)` }
                : { flex: 1, minWidth: 0 }
            }
          >
            <SongStageBoard song={song} />
          </div>

          {/* Boundary bar — show/hide toggle for the column plus the drag grip
              that resizes it. Desktop only. */}
          <div className="hidden lg:flex lg:order-2 w-6 shrink-0 flex-col items-center">
            <button
              type="button"
              onClick={() => setAccordionColumnVisible(!accordionColumnVisible)}
              aria-expanded={accordionColumnVisible}
              aria-label={
                accordionColumnVisible
                  ? t('layout.hidePanel')
                  : t('layout.showPanel')
              }
              title={
                accordionColumnVisible
                  ? t('layout.hidePanel')
                  : t('layout.showPanel')
              }
              data-testid="pp-accordion-toggle"
              className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-indigo-100 hover:text-indigo-500 dark:hover:bg-indigo-900/30"
            >
              {accordionColumnVisible ? (
                <PanelRightClose size={16} />
              ) : (
                <PanelRightOpen size={16} />
              )}
            </button>
            {accordionColumnVisible ? (
              <div
                className="group mt-1 flex flex-1 w-full cursor-col-resize items-center justify-center rounded transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                onMouseDown={handlePpDividerMouseDown}
              >
                <GripVertical
                  size={16}
                  className="text-gray-400 group-hover:text-indigo-500 transition-colors"
                />
              </div>
            ) : null}
          </div>

          {showAccordionColumn ? (
            <SongAccordionColumn
              isLargeScreen={isLargeScreen}
              song={song}
              bookmarksOpen={bookmarksOpen}
              versionsOpen={versionsOpen}
              onToggleBookmarks={() => setBookmarksOpen(!bookmarksOpen)}
              onToggleVersions={() => setVersionsOpen(!versionsOpen)}
              onSelectBookmarkSong={handleBookmarkSongClick}
              onAddAllBookmarksToSchedule={handleAddAllBookmarksToSchedule}
              canViewSongVersions={canViewSongVersions}
              canAddSongVersion={canAddSongVersion}
              canEditSongVersion={canEditSongVersion}
              canDeleteSongVersion={canDeleteSongVersion}
              attentionBadge={
                undismissedSuggestionCount > 0
                  ? `+${undismissedSuggestionCount}`
                  : null
              }
              className="order-3"
              style={
                isLargeScreen
                  ? { width: `calc(${100 - ppDividerPosition}% - 12px)` }
                  : undefined
              }
            />
          ) : null}
        </div>
      ) : (
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
                previewMode={previewMode}
                stagedSlideIndex={stagedSlideIndex}
                onSlideDoubleClick={handleSlideProject}
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
            {/* Control Panel column (now owns the full height of its column).
              When the right column is hidden it grows to fill the row, leaving
              only the slim rail below for bringing the column back. */}
            <div
              className="h-full overflow-hidden"
              style={
                isLargeScreen && accordionColumnVisible
                  ? { width: `calc(${rightDividerPosition}% - 12px)` }
                  : { flex: 1, minWidth: 0 }
              }
            >
              <SongControlPanel
                songId={numericId}
                onPrevSlide={handlePrevSlide}
                onNextSlide={handleNextSlide}
                canNavigatePrev={canNavigatePrev}
                canNavigateNext={canNavigateNext}
                previewMode={previewMode}
                onTogglePreviewMode={togglePreviewMode}
                previewContent={stagedPreviewContent}
                canProject={
                  previewMode &&
                  stagedSlideIndex !== null &&
                  stagedSlideIndex !== presentedSlideIndex
                }
                onProject={handleProjectStaged}
                isProjecting={presentTemporarySong.isPending}
                onHide={handleHidePresentation}
                isHiding={clearTemporary.isPending}
              />
            </div>

            {/* Boundary bar — hosts the show/hide toggle for the whole right
              column plus the drag grip that resizes it. Desktop only; the bar
              stays put when collapsed so the rail toggle is always reachable. */}
            <div className="hidden lg:flex w-6 shrink-0 flex-col items-center">
              <button
                type="button"
                onClick={() =>
                  setAccordionColumnVisible(!accordionColumnVisible)
                }
                aria-expanded={accordionColumnVisible}
                aria-label={
                  accordionColumnVisible
                    ? t('layout.hidePanel')
                    : t('layout.showPanel')
                }
                title={
                  accordionColumnVisible
                    ? t('layout.hidePanel')
                    : t('layout.showPanel')
                }
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-indigo-100 hover:text-indigo-500 dark:hover:bg-indigo-900/30"
              >
                {accordionColumnVisible ? (
                  <PanelRightClose size={16} />
                ) : (
                  <PanelRightOpen size={16} />
                )}
              </button>
              {accordionColumnVisible ? (
                <div
                  className="group mt-1 flex flex-1 w-full cursor-col-resize items-center justify-center rounded transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                  onMouseDown={handleRightDividerMouseDown}
                >
                  <GripVertical
                    size={16}
                    className="text-gray-400 group-hover:text-indigo-500 transition-colors"
                  />
                </div>
              ) : null}
            </div>

            {/* Accordion column — Marcaje on top, Versiuni below. Bookmarks are
              hidden on mobile (the page is too tight); Versions ride along on
              mobile. Hidden entirely on desktop when the operator collapses it. */}
            {showAccordionColumn ? (
              <SongAccordionColumn
                isLargeScreen={isLargeScreen}
                song={song}
                bookmarksOpen={bookmarksOpen}
                versionsOpen={versionsOpen}
                onToggleBookmarks={() => setBookmarksOpen(!bookmarksOpen)}
                onToggleVersions={() => setVersionsOpen(!versionsOpen)}
                onSelectBookmarkSong={handleBookmarkSongClick}
                onAddAllBookmarksToSchedule={handleAddAllBookmarksToSchedule}
                canViewSongVersions={canViewSongVersions}
                canAddSongVersion={canAddSongVersion}
                canEditSongVersion={canEditSongVersion}
                canDeleteSongVersion={canDeleteSongVersion}
                attentionBadge={
                  undismissedSuggestionCount > 0
                    ? `+${undismissedSuggestionCount}`
                    : null
                }
                style={
                  isLargeScreen
                    ? { width: `calc(${100 - rightDividerPosition}% - 12px)` }
                    : undefined
                }
              />
            ) : null}
          </div>
        </div>
      )}

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
