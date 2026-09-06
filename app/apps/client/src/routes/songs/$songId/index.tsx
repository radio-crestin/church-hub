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
  Loader2,
  MoreHorizontal,
  Music,
  Music2,
  Pencil,
  Projector,
  Tag,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePageShortcutEvent } from '~/features/keyboard-shortcuts/utils'
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
import type { ScheduleItem } from '~/features/schedules'
import {
  AddSongToScheduleModal,
  getSchedulePassageTarget,
  ScheduleLiveItemPanel,
  SchedulePanel,
  useScheduleFlatNavigation,
  useSelectedScheduleId,
} from '~/features/schedules'
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
  SongStageBoard,
  SongVersionsPanel,
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
import { useMarkEntitySeen } from '~/features/sync'
import type { WorkspaceLayout, WorkspacePanel } from '~/features/workspace'
import { useEditLayoutAction, Workspace } from '~/features/workspace'
import { usePersistedBoolean } from '~/hooks/usePersistedBoolean'
import { usePermissions } from '~/provider/permissions-provider'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import type { ActionMenuItem } from '~/ui/menu'
import { ActionMenu } from '~/ui/menu'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'

interface SongSearchParams {
  q?: string
  reset?: number
  aiSearchId?: number
}

/**
 * Where each panel starts out on the classic song page: verses on the left, the
 * control panel (with the live preview) in the middle, and the side panels
 * stacked on the right. Operators drag them anywhere from there.
 */
const CLASSIC_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['slides'] },
    { id: 'col-2', panelIds: ['control'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
}

/** PowerPoint layout: the stage board takes the room, side panels ride along. */
const POWERPOINT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['stage'] },
    { id: 'col-2', panelIds: ['bookmarks', 'schedules', 'versions'] },
  ],
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
  const { t: tSchedules } = useTranslation('schedules')
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
  // The Programe panel reads schedules and edits their items (sung marker,
  // remove), so it needs both program perms to be useful.
  const canViewSchedules =
    hasPermission('programs.view') && hasPermission('programs.edit')
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

  // Opening a song reviews its "updated elsewhere" sync badge.
  useMarkEntitySeen('song', Number.isNaN(numericId) ? null : numericId)

  const { data: song, isLoading, isError } = useSong(numericId)
  const presentTemporarySong = usePresentTemporarySong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { data: presentationState } = usePresentationState()
  // The Programe panel in the right column owns the program selection; when the
  // projector is showing a step of THAT program, this page's next/prev has to
  // walk the program rather than just this song.
  const selectedScheduleId = useSelectedScheduleId()
  const scheduleNav = useScheduleFlatNavigation({
    scheduleId: canViewSchedules ? selectedScheduleId : null,
  })
  const isScheduleLive = scheduleNav.isScheduleLive
  const { saveSong, isPending: isSaving } = useSaveSongToFile()
  const resetPresentationCount = useResetPresentationCount()
  const upsertSong = useUpsertSong()
  const addBookmarkMutation = useAddBookmark()
  const removeBookmarkMutation = useRemoveBookmark()
  const { data: bookmarks = [] } = useSongBookmarks()
  const { showToast } = useToast()

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
  // Right-column panel state. Persisted per device so the operator's last
  // choice (which sections are expanded) carries over to the next song they
  // open. Where those panels *sit* is owned by the workspace, not by this page.
  const [bookmarksOpen, setBookmarksOpen] = usePersistedBoolean(
    'song-detail:bookmarks-open',
    true,
  )
  // Programe starts collapsed: it is an opt-in third section, and expanding it
  // by default would shrink the two panels operators already rely on.
  const [schedulesOpen, setSchedulesOpen] = usePersistedBoolean(
    'song-detail:schedules-open',
    false,
  )
  const [versionsOpen, setVersionsOpen] = usePersistedBoolean(
    'song-detail:versions-open',
    true,
  )
  const [pendingExit, setPendingExit] = useState(false)
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
          styleOverrides: s.styleOverrides,
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

  /**
   * This song's place in the selected program, if it has one. A song can sit in
   * a program twice, so the occurrence already on the projector wins — that is
   * the one the operator is working through.
   */
  const scheduleItemForSong = useMemo(() => {
    if (!selectedScheduleId) return null
    const liveItem = scheduleNav.flatItems[scheduleNav.currentFlatIndex]?.item
    if (liveItem?.itemType === 'song' && liveItem.songId === numericId) {
      return liveItem
    }
    return (
      scheduleNav.items.find(
        (item) => item.itemType === 'song' && item.songId === numericId,
      ) ?? null
    )
  }, [
    selectedScheduleId,
    scheduleNav.flatItems,
    scheduleNav.currentFlatIndex,
    scheduleNav.items,
    numericId,
  ])

  /**
   * Projects one slide of this song. When the song belongs to the selected
   * program the slide goes up *as a step of that program*, so the cursor lands
   * in the program and next carries on into whatever follows the song.
   */
  const presentSlide = useCallback(
    async (index: number) => {
      if (scheduleItemForSong) {
        await scheduleNav.presentSongSlide(scheduleItemForSong, index)
        return
      }
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
    },
    [scheduleItemForSong, scheduleNav, numericId, presentTemporarySong],
  )

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
      await presentSlide(index)
    },
    [previewMode, isThisSongLive, presentSlide],
  )

  // Preview mode: double-click projects the slide immediately. Keep the stage
  // showing it until the projection lands, then clear (live now mirrors it).
  const handleSlideProject = useCallback(
    async (_slide: SongSlide, index: number) => {
      await presentSlide(index)
      setStagedSlideIndex(null)
    },
    [presentSlide],
  )

  // Project the currently staged slide (Afișează button).
  const handleProjectStaged = useCallback(async () => {
    if (stagedSlideIndex === null) return
    await presentSlide(stagedSlideIndex)
    setStagedSlideIndex(null)
  }, [stagedSlideIndex, presentSlide])

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
    // Walking a program: step back through the program's own running order, so
    // the first slide of a song reaches the last verse of what came before it.
    if (isScheduleLive) {
      await scheduleNav.goPrev()
      return
    }
    // Don't gate on the client's (possibly-lagging) slide index — a fast
    // next→prev on a presenter remote would otherwise no-op because the local
    // index hasn't caught up yet. The server clamps prev at the first slide
    // (it never closes on prev), so this is safe.
    if (presentedSlideIndex !== null) {
      await navigateTemporary.mutateAsync({ direction: 'prev' })
    }
  }, [isScheduleLive, scheduleNav, presentedSlideIndex, navigateTemporary])

  const handleNextSlide = useCallback(async () => {
    // Walking a program: past the song's last slide comes the next program
    // item, not the end of the presentation.
    if (isScheduleLive) {
      await scheduleNav.goNext()
      return
    }
    // Allow navigation even on last slide - server will end presentation
    if (presentedSlideIndex !== null) {
      await navigateTemporary.mutateAsync({ direction: 'next' })
    }
  }, [isScheduleLive, scheduleNav, presentedSlideIndex, navigateTemporary])

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

  // Every bookmark row for this song. A song may be bookmarked more than once,
  // so this is a list rather than a flag.
  const songBookmarks = useMemo(
    () => bookmarks.filter((b) => b.songId === numericId),
    [bookmarks, numericId],
  )
  const isBookmarked = songBookmarks.length > 0

  /**
   * The toolbar icon reads as "this song is in Marcaje", so it stays a strict
   * toggle: pressing it when bookmarked clears every copy. The song list's own
   * per-row bookmark button follows the same rule; extra copies of one song are
   * an explicit Marcaje-panel operation, never a side effect of pressing a
   * button that looks like an on/off switch.
   */
  const handleToggleBookmark = useCallback(() => {
    // A negative id is a row the optimistic add hasn't heard back from the
    // server for yet — pressing again before that round trip lands would
    // fire a DELETE for an id the server has never seen, so no-op instead;
    // the icon is already showing the right (optimistic) state.
    if (songBookmarks.some((b) => b.id < 0)) return
    if (isBookmarked) {
      for (const bookmark of songBookmarks) {
        removeBookmarkMutation.mutate(bookmark.id)
      }
    } else {
      addBookmarkMutation.mutate(numericId)
    }
  }, [
    isBookmarked,
    songBookmarks,
    numericId,
    addBookmarkMutation,
    removeBookmarkMutation,
  ])

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
      await presentSlide(selectedSlideIndex)
    }
  }, [song, selectedSlideIndex, expandedSlidesCount, presentSlide])

  // In PowerPoint mode the stage board owns keyboard navigation (arrows must
  // move the canvas selection too), so the classic-page handlers stand down to
  // avoid double navigation on the shared keyboard registry.
  const classicKeyboard = editorLayout !== 'powerpoint'

  // Keyboard shortcuts for when a slide is presented
  // Also armed while a step of the selected program is live even though it is
  // not this song — that is exactly when next has to cross into the next item.
  useSongKeyboardShortcuts({
    onNextSlide: handleNextSlide,
    onPreviousSlide: handlePrevSlide,
    onHidePresentation: handleHidePresentation,
    enabled:
      classicKeyboard && (presentedSlideIndex !== null || isScheduleLive),
  })

  // Keyboard navigation for slide selection when nothing is presented
  useSongSlideSelectionKeyboard({
    slidesCount: expandedSlidesCount,
    selectedSlideIndex,
    onSelectSlide: setSelectedSlideIndex,
    onPresentSlide: handlePresentSelectedSlide,
    onGoBack: handleGoBack,
    enabled: classicKeyboard && presentedSlideIndex === null && !isScheduleLive,
  })

  // The page's own "show the selected slide" shortcut (Settings → Shortcuts →
  // Songs). In PowerPoint mode the stage board answers it instead.
  usePageShortcutEvent(
    'songs',
    'showSlide',
    handlePresentSelectedSlide,
    classicKeyboard,
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

  const handleAddAllBookmarksToSchedule = useCallback(() => {
    setBookmarkSongIds(bookmarks.map((b) => b.songId))
    setShowAddBookmarksToScheduleModal(true)
  }, [bookmarks])

  const handleScheduleSongClick = useCallback(
    (targetSongId: number) => {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(targetSongId) },
        search: { q: searchQuery || undefined },
      })
    },
    [navigate, searchQuery],
  )

  /**
   * "Vezi si versete" is on and a verse row was clicked — jump into the Bible
   * module at that exact passage.
   */
  const handleSchedulePassageClick = useCallback(
    (item: ScheduleItem) => {
      const target = getSchedulePassageTarget(item)
      if (!target) return
      navigate({
        to: '/bible/',
        search: {
          bookName: target.bookName,
          chapter: target.chapter,
          verse: target.verse,
          select: true,
        },
      })
    },
    [navigate],
  )

  const handleOpenSchedule = useCallback(
    (scheduleId: number) => {
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(scheduleId) },
      })
    },
    [navigate],
  )

  // The two editor layouts keep their arrangements apart, so the action follows
  // whichever workspace is on screen. It has to be built up here with the other
  // hooks: the loading branch below returns before the rest of the page runs.
  const editLayoutAction = useEditLayoutAction(
    editorLayout === 'powerpoint' && canEditSong
      ? 'song-detail-powerpoint'
      : 'song-detail',
  )

  if (isLoading || !song) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  const canNavigatePrev = isScheduleLive
    ? scheduleNav.canNavigatePrev
    : presentedSlideIndex !== null && presentedSlideIndex > 0
  // Allow navigating next even on last slide - server will end presentation
  const canNavigateNext = isScheduleLive
    ? scheduleNav.canNavigateNext
    : presentedSlideIndex !== null

  /**
   * While a program step is live the left rail follows the projector rather
   * than this song — except when the live step IS a slide of this song, where
   * the song's own list already shows it (and keeps its edit mode and font
   * controls).
   */
  const liveProgramItem = isScheduleLive
    ? scheduleNav.flatItems[scheduleNav.currentFlatIndex]?.item
    : undefined
  const showsLiveProgramItem =
    !!liveProgramItem &&
    !(
      liveProgramItem.itemType === 'song' &&
      liveProgramItem.songId === numericId
    )

  const isPowerpointLayout = editorLayout === 'powerpoint' && canEditSong

  // Marcaje / Programe / Versiuni. Bookmarks and Programe are desktop-only —
  // the page is too tight for them on a phone — while Versiuni rides along
  // everywhere. An unavailable panel keeps its stored slot for when it returns.
  const sidePanels: WorkspacePanel[] = [
    {
      id: 'bookmarks',
      title: t('bookmarks.title'),
      available: isLargeScreen,
      collapsed: !bookmarksOpen,
      render: () => (
        <SongBookmarksPanel
          onSelectSong={handleBookmarkSongClick}
          onAddAllToSchedule={
            bookmarks.length > 0 ? handleAddAllBookmarksToSchedule : undefined
          }
          activeSongId={song.id}
          isCollapsed={!bookmarksOpen}
          onToggleCollapse={() => setBookmarksOpen(!bookmarksOpen)}
        />
      ),
    },
    {
      id: 'schedules',
      title: tSchedules('panel.title'),
      available: canViewSchedules && isLargeScreen,
      collapsed: !schedulesOpen,
      render: () => (
        <SchedulePanel
          activeSongId={song.id}
          onSelectSong={handleScheduleSongClick}
          onSelectPassage={handleSchedulePassageClick}
          onOpenSchedule={handleOpenSchedule}
          candidateSong={{ id: song.id, title: song.title }}
          onAddAllBookmarks={
            bookmarks.length > 0 ? handleAddAllBookmarksToSchedule : undefined
          }
          isCollapsed={!schedulesOpen}
          onToggleCollapse={() => setSchedulesOpen(!schedulesOpen)}
        />
      ),
    },
    {
      id: 'versions',
      title: t('versions.title'),
      available: canViewSongVersions,
      collapsed: !versionsOpen,
      render: () => (
        <SongVersionsPanel
          songId={song.id}
          songTitle={song.title}
          currentSong={{
            hymnNumber: song.hymnNumber,
            author: song.author,
            keyLine: song.keyLine,
            categoryName: song.category?.name ?? null,
          }}
          canAdd={canAddSongVersion}
          canEdit={canEditSongVersion}
          canDelete={canDeleteSongVersion}
          isCollapsed={!versionsOpen}
          onToggleCollapse={() => setVersionsOpen(!versionsOpen)}
          attentionBadge={
            undismissedSuggestionCount > 0
              ? `+${undismissedSuggestionCount}`
              : null
          }
        />
      ),
    },
  ]

  // The control panel comes first in this list only because that is the order
  // panels stack in on a phone; on desktop the workspace layout decides.
  const workspacePanels: WorkspacePanel[] = isPowerpointLayout
    ? [
        {
          id: 'stage',
          title: t('layout.stage'),
          render: () => <SongStageBoard song={song} />,
        },
        ...sidePanels,
      ]
    : [
        {
          id: 'control',
          title: t('layout.controlPanel'),
          render: () => (
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
          ),
        },
        {
          id: 'slides',
          title: t('preview.slides'),
          render: () => (
            <div
              className={`overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${
                isLargeScreen ? 'relative h-full' : ''
              }`}
            >
              <div className={isLargeScreen ? 'absolute inset-0 p-4' : 'p-3'}>
                {showsLiveProgramItem ? (
                  <ScheduleLiveItemPanel nav={scheduleNav} />
                ) : (
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
                )}
              </div>
            </div>
          ),
        },
        ...sidePanels,
      ]

  /**
   * Every page-level action lives behind one labelled menu. Icon-only buttons
   * forced people to guess (or hover) what each one did; a menu row carries the
   * icon, a real label and a one-line hint, so the same actions stay one click
   * away without a wall of coloured squares.
   */
  const actionMenuItems: ActionMenuItem[] = [
    {
      id: 'bookmark',
      label: isBookmarked ? t('bookmarks.remove') : t('bookmarks.add'),
      description: t('actionsMenu.bookmarkDescription'),
      icon: isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />,
      iconClassName: isBookmarked
        ? 'bg-amber-500 text-white'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      active: isBookmarked,
      onSelect: handleToggleBookmark,
      testId: 'song-bookmark-toggle',
    },
    {
      id: 'add-to-schedule',
      label: t('actions.addToSchedule'),
      description: t('actionsMenu.addToScheduleDescription'),
      icon: <CalendarPlus size={18} />,
      iconClassName:
        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      onSelect: () => setShowAddToScheduleModal(true),
      testId: 'song-add-to-schedule',
    },
    {
      id: 'key-line',
      label: t('actions.setKeyLine'),
      description: t('actionsMenu.setKeyLineDescription'),
      icon: <Music size={18} />,
      onSelect: handleOpenKeyLineDialog,
      testId: 'song-set-key-line',
    },
    {
      id: 'save-to-file',
      label: t('actions.saveToFile'),
      description: t('actionsMenu.saveToFileDescription'),
      icon: <Download size={18} />,
      disabled: isSaving,
      onSelect: handleOpenExportModal,
      testId: 'song-save-to-file',
    },
    ...(canEditSong
      ? [
          {
            id: 'toggle-layout',
            label: t('stageEditor.toggleLayout'),
            description: t('actionsMenu.toggleLayoutDescription'),
            icon: <Projector size={18} />,
            iconClassName:
              'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
            active: editorLayout === 'powerpoint',
            onSelect: () =>
              setEditorLayout(
                editorLayout === 'powerpoint' ? 'normal' : 'powerpoint',
              ),
            testId: 'song-toggle-layout',
          },
          {
            id: 'edit',
            label: t('preview.edit'),
            description: t('actionsMenu.editDescription'),
            icon: <Pencil size={18} />,
            iconClassName:
              'bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white',
            onSelect: handleEdit,
            testId: 'song-edit',
          },
        ]
      : []),
    // Panels only form movable columns on a large screen; on a phone they are
    // a plain stack, so there is nothing to rearrange.
    ...(isLargeScreen ? [editLayoutAction] : []),
  ]

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
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
        {/* Every page action lives in one labelled menu — see actionMenuItems. */}
        <div className="flex items-center gap-2 sm:justify-end shrink-0">
          <ActionMenu
            items={actionMenuItems}
            label={t('actionsMenu.trigger')}
            triggerIcon={<MoreHorizontal size={16} />}
            testId="song-actions-menu"
          />
        </div>
      </div>

      <Workspace
        id={isPowerpointLayout ? 'song-detail-powerpoint' : 'song-detail'}
        panels={workspacePanels}
        defaultLayout={
          isPowerpointLayout
            ? POWERPOINT_WORKSPACE_LAYOUT
            : CLASSIC_WORKSPACE_LAYOUT
        }
        defaultColumnSizes={
          isPowerpointLayout ? ['74%', '26%'] : ['30%', '40%', '30%']
        }
        stacked={!isLargeScreen}
        className="flex-1 lg:min-h-0"
      />

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
