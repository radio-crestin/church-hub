import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bookmark,
  CalendarPlus,
  Compass,
  Download,
  Eye,
  FileText,
  ImageOff,
  Loader2,
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
  PhoneSlideControls,
  PhoneStage,
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
import type { ScheduleItem } from '~/features/schedules'
import {
  AddSongToScheduleModal,
  getSchedulePassageTarget,
  liveProgramItemForSong,
  ScheduleLiveItemPanel,
  SchedulePanel,
  useScheduleFlatNavigation,
  useSelectedScheduleId,
} from '~/features/schedules'
import {
  type ExportFormat,
  ExportFormatModal,
  type SaveFormat,
  useSaveSongToFile,
} from '~/features/song-export'
import { useSongHistoryAction } from '~/features/song-history'
import {
  KeyLineEditDialog,
  type KeyLineEditDialogHandle,
} from '~/features/song-key'
import { useSubmitToLibraryAction } from '~/features/song-library'
import {
  CategoryEditDialog,
  type CategoryEditDialogHandle,
  PreviewModeToggle,
  SameThemeModal,
  SongBookmarksPanel,
  SongControlPanel,
  SongEditor,
  SongLoadError,
  SongSlidesPanel,
  SongStageBoard,
  SongVersionsPanel,
} from '~/features/songs/components'
import type { SongEditorMode } from '~/features/songs/components/song-editor/SongEditorModeSwitch'
import {
  useAddBookmark,
  useHasMediaPreviewBackground,
  useIsLargeScreen,
  usePreviewMode,
  useRemoveBookmark,
  useResetPresentationCount,
  useSong,
  useSongBookmarks,
  useSongEditorLayout,
  useSongKeyboardShortcuts,
  useSongSlideSelectionKeyboard,
  useUndismissedSuggestionCount,
} from '~/features/songs/hooks'
import type { SongSlide } from '~/features/songs/types'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { useMarkEntitySeen } from '~/features/sync'
import type { WorkspaceLayout, WorkspacePanel } from '~/features/workspace'
import {
  useDefaultLayoutMigration,
  useEditLayoutAction,
  Workspace,
} from '~/features/workspace'
import { usePersistedBoolean } from '~/hooks/usePersistedBoolean'
import { usePermissions } from '~/provider/permissions-provider'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import type { ActionMenuItem } from '~/ui/menu'
import { ActionMenu } from '~/ui/menu'
import { ConfirmModal } from '~/ui/modal'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { useToast } from '~/ui/toast'

interface SongSearchParams {
  q?: string
  reset?: number
  aiSearchId?: number
  /** Open the song editor, on its slides or on its text. */
  edit?: SongEditorMode
}

/**
 * Where each panel starts out on the classic song page: verses on the left, the
 * control panel (with the live preview) in the middle with the song's versions
 * under it, and Marcaje / Programe stacked on the right. Operators drag them
 * anywhere from there.
 */
const CLASSIC_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['slides'] },
    { id: 'col-2', panelIds: ['control', 'versions'] },
    { id: 'col-3', panelIds: ['bookmarks', 'schedules'] },
  ],
}

/**
 * The classic arrangement before Versiuni moved under the preview. A device
 * still arranged exactly like this never chose it, so it moves to the new
 * default (see `useDefaultLayoutMigration`).
 */
const PREVIOUS_CLASSIC_WORKSPACE_LAYOUT: WorkspaceLayout = {
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
  component: SongPage,
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
    edit:
      search.edit === 'slides' || search.edit === 'text'
        ? search.edit
        : undefined,
  }),
})

/** The song page, or its editor while one is open (always, for a new song). */
function SongPage() {
  const { songId } = Route.useParams()
  const { edit } = Route.useSearch()
  return songId === 'new' || edit ? (
    <SongEditorPage mode={edit ?? 'slides'} />
  ) : (
    <SongPreviewPage />
  )
}

function SongEditorPage({ mode }: { mode: SongEditorMode }) {
  const navigate = useNavigate()
  const { songId } = Route.useParams()
  const { q, reset } = Route.useSearch()
  const isNew = songId === 'new'

  // The app's reset shortcut goes back to the song list from here too.
  useEffect(() => {
    if (reset) navigate({ to: '/songs', search: { reset, fromSong: true } })
  }, [reset, navigate])

  const backToList = useCallback(
    () => navigate({ to: '/songs', search: { q } }),
    [navigate, q],
  )

  return (
    <PagePermissionGuard permission={isNew ? 'songs.create' : 'songs.edit'}>
      <SongEditor
        songId={isNew ? null : Number(songId)}
        initialMode={mode}
        onClose={
          isNew
            ? backToList
            : () =>
                navigate({
                  to: '/songs/$songId',
                  params: { songId },
                  search: { q },
                })
        }
        onCreated={(id) =>
          navigate({
            to: '/songs/$songId',
            params: { songId: String(id) },
            search: { q, edit: mode },
            replace: true,
          })
        }
        onDeleted={backToList}
      />
    </PagePermissionGuard>
  )
}

function SongPreviewPage() {
  const { t } = useTranslation('songs')
  const { t: tSchedules } = useTranslation('schedules')
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canEditSong = hasPermission('songs.edit')
  const [editorLayout, setEditorLayout] = useSongEditorLayout()
  useDefaultLayoutMigration('song-detail', PREVIOUS_CLASSIC_WORKSPACE_LAYOUT)
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
        to: '/songs',
        search: { reset, fromSong: true },
      })
    }
  }, [reset, navigate])
  const numericId = parseInt(songId, 10)
  const isValidSongId = Number.isInteger(numericId) && numericId > 0

  // Opening a song reviews its "updated elsewhere" sync badge.
  useMarkEntitySeen('song', Number.isNaN(numericId) ? null : numericId)

  const songQuery = useSong(isValidSongId ? numericId : null)
  const { data: song, isLoading, isError } = songQuery
  // Only the server saying "no such song" (null) means missing. A failed or
  // slow load is not: it gets a retry instead (T-096).
  const isSongMissing = !isValidSongId || song === null
  const queryClient = useQueryClient()
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
  const songHistory = useSongHistoryAction(numericId, song?.title ?? '')
  const submitToLibrary = useSubmitToLibraryAction(numericId, song?.title ?? '')
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
  const isLargeScreen = useIsLargeScreen()
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
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
  const [showSameThemeModal, setShowSameThemeModal] = useState(false)
  // Plain black behind the lyrics in this page's previews (both layouts), so
  // they are easy to read. Never changes what the screens show. Only an image
  // or a video has anything to hide: without one the "More" menu drops the
  // option and the previews show the colour, while the saved choice waits for
  // the next song that has one.
  const [hideBackgroundChoice, setHideBackgroundChoice] = usePersistedBoolean(
    'song-detail:hide-background',
    false,
  )
  const hasMediaPreviewBackground = useHasMediaPreviewBackground(
    song?.background ?? null,
  )
  const hidePreviewBackground =
    hideBackgroundChoice && hasMediaPreviewBackground
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
        background: song.background,
      },
    }
  }, [previewMode, stagedSlideIndex, song, expandedSlides])

  const backToSongList = useCallback(() => {
    navigate({
      to: '/songs',
      search: { fromSong: true, q: searchQuery || undefined },
    })
  }, [navigate, searchQuery])

  // A deleted song: say so and go back to the list, refreshed so it drops out.
  useEffect(() => {
    if (!isSongMissing) return
    // Clear last visited to prevent navigation loop
    clearSectionLastVisited('songs')
    queryClient.invalidateQueries({ queryKey: ['songs'] })
    showToast(t('messages.notFound'), 'error')
    backToSongList()
  }, [isSongMissing, queryClient, showToast, t, backToSongList])

  // Save last visited song to localStorage
  useEffect(() => {
    if (song && !isLoading) {
      setSongsLastVisited({
        songId: numericId,
        searchQuery: searchQuery || undefined,
      })
    }
  }, [song, isLoading, numericId, searchQuery])

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
   * Projects one slide of this song. While the selected program is on the
   * projector and holds this song, the slide goes up *as a step of that
   * program*, so the program keeps its place and next carries on into whatever
   * follows the song. Otherwise the song goes up on its own.
   */
  const presentSlide = useCallback(
    async (index: number) => {
      const programItem = liveProgramItemForSong(scheduleNav, numericId)
      if (programItem) {
        await scheduleNav.presentSongSlide(programItem, index)
        return
      }
      await presentTemporarySong.mutateAsync({
        songId: numericId,
        slideIndex: index,
      })
    },
    [scheduleNav, numericId, presentTemporarySong],
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
      to: '/songs',
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
    navigate({
      to: '/songs/$songId',
      params: { songId },
      search: { q: searchQuery, edit: 'slides' },
    })
  }, [navigate, songId, searchQuery])

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

  const saveSongAs = useCallback(
    async (format: SaveFormat) => {
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

  const handleExportFormatConfirm = useCallback(
    (format: ExportFormat) => {
      setShowExportFormatModal(false)
      return saveSongAs(format)
    },
    [saveSongAs],
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
        to: '/bible',
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

  if (!song) {
    if (isError) {
      return (
        <SongLoadError
          isRetrying={songQuery.isFetching}
          onRetry={() => songQuery.refetch()}
          onBack={backToSongList}
        />
      )
    }
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-fg-hint" />
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

  // Marcaje / Programe / Versiuni: side panels on a computer, tabs under the
  // verses on a phone, where each is always open (the tab is the toggle). An
  // unavailable panel keeps its stored slot for when it returns.
  const sidePanels: WorkspacePanel[] = [
    {
      id: 'bookmarks',
      title: t('bookmarks.title'),
      collapsed: !bookmarksOpen,
      render: () => (
        <SongBookmarksPanel
          onSelectSong={handleBookmarkSongClick}
          onAddAllToSchedule={
            bookmarks.length > 0 ? handleAddAllBookmarksToSchedule : undefined
          }
          activeSongId={song.id}
          isCollapsed={isLargeScreen && !bookmarksOpen}
          onToggleCollapse={
            isLargeScreen ? () => setBookmarksOpen(!bookmarksOpen) : undefined
          }
        />
      ),
    },
    {
      id: 'schedules',
      title: tSchedules('panel.title'),
      available: canViewSchedules,
      collapsed: !schedulesOpen,
      render: () => (
        <SchedulePanel
          activeSongId={song.id}
          onSelectSong={handleScheduleSongClick}
          onSelectPassage={handleSchedulePassageClick}
          onOpenSchedule={handleOpenSchedule}
          // Marcaje sits right above this panel here too, so a song can be
          // carried from one into the selected program without leaving the
          // page.
          acceptsSongDrop
          onAddAllBookmarks={
            bookmarks.length > 0 ? handleAddAllBookmarksToSchedule : undefined
          }
          isCollapsed={isLargeScreen && !schedulesOpen}
          onToggleCollapse={
            isLargeScreen ? () => setSchedulesOpen(!schedulesOpen) : undefined
          }
        />
      ),
    },
    {
      id: 'versions',
      title: isLargeScreen ? t('versions.title') : t('layout.versionsTab'),
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
          isCollapsed={isLargeScreen && !versionsOpen}
          onToggleCollapse={
            isLargeScreen ? () => setVersionsOpen(!versionsOpen) : undefined
          }
          onShowSameTheme={() => setShowSameThemeModal(true)}
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
          render: () => (
            <SongStageBoard
              song={song}
              scheduleNav={scheduleNav}
              onPresentSlide={presentSlide}
              hideBackground={hidePreviewBackground}
            />
          ),
        },
        ...sidePanels,
      ]
    : [
        {
          id: 'control',
          title: t('layout.controlPanel'),
          defaultSize: '62%',
          pinned: true,
          render: () =>
            isLargeScreen ? (
              <SongControlPanel
                songId={numericId}
                onPrevSlide={handlePrevSlide}
                onNextSlide={handleNextSlide}
                canNavigatePrev={canNavigatePrev}
                canNavigateNext={canNavigateNext}
                isNavigating={navigateTemporary.isPending}
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
                hideBackground={hidePreviewBackground}
              />
            ) : (
              <PhoneStage
                testId="song-phone-stage"
                isLive={isThisSongLive}
                headerActions={
                  <PreviewModeToggle
                    previewMode={previewMode}
                    onTogglePreviewMode={togglePreviewMode}
                  />
                }
                previewContent={stagedPreviewContent}
                hideBackground={hidePreviewBackground}
              />
            ),
        },
        {
          id: 'slides',
          title: isLargeScreen ? t('preview.slides') : t('layout.versesTab'),
          render: () => (
            <div
              className={`overflow-hidden rounded-xl border border-line bg-panel ${
                isLargeScreen ? 'relative h-full' : ''
              }`}
            >
              <div className={`p-3 ${isLargeScreen ? 'absolute inset-0' : ''}`}>
                {showsLiveProgramItem ? (
                  <ScheduleLiveItemPanel nav={scheduleNav} />
                ) : (
                  <SongSlidesPanel
                    song={song}
                    presentedSlideIndex={presentedSlideIndex}
                    selectedSlideIndex={selectedSlideIndex}
                    isLoading={isLoading}
                    onSlideClick={handleSlideClick}
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
   * Page-level actions live behind one labelled menu: a menu row carries the
   * icon, a real label and a one-line hint, so they stay one click away without
   * a wall of coloured squares. Marking the song, adding it to a program and
   * setting its key are used during a service, so those sit beside the menu
   * instead.
   */
  const actionMenuItems: ActionMenuItem[] = [
    {
      id: 'save-to-file',
      label: t('actions.saveToFile'),
      description: t('actionsMenu.saveToFileDescription'),
      icon: <Download size={16} strokeWidth={1.5} />,
      disabled: isSaving,
      onSelect: handleOpenExportModal,
      testId: 'song-save-to-file',
    },
    {
      id: 'export-pdf',
      label: t('actions.exportPdf'),
      description: t('actionsMenu.exportPdfDescription'),
      icon: <FileText size={16} strokeWidth={1.5} />,
      disabled: isSaving,
      onSelect: () => saveSongAs('pdf'),
      testId: 'song-export-pdf',
    },
    {
      id: 'export-docx',
      label: t('actions.exportDocx'),
      description: t('actionsMenu.exportDocxDescription'),
      icon: <FileText size={16} strokeWidth={1.5} />,
      disabled: isSaving,
      onSelect: () => saveSongAs('docx'),
      testId: 'song-export-docx',
    },
    ...(hasMediaPreviewBackground
      ? [
          {
            id: 'hide-background',
            label: t('preview.hideBackground'),
            description: t('actionsMenu.hideBackgroundDescription'),
            icon: <ImageOff size={16} strokeWidth={1.5} />,
            active: hidePreviewBackground,
            onSelect: () => setHideBackgroundChoice(!hideBackgroundChoice),
            testId: 'song-preview-hide-background',
          },
        ]
      : []),
    ...(canEditSong
      ? [
          {
            id: 'toggle-layout',
            label: t('stageEditor.toggleLayout'),
            description: t('actionsMenu.toggleLayoutDescription'),
            icon: <Projector size={16} strokeWidth={1.5} />,
            active: editorLayout === 'powerpoint',
            onSelect: () =>
              setEditorLayout(
                editorLayout === 'powerpoint' ? 'normal' : 'powerpoint',
              ),
            testId: 'song-toggle-layout',
          },
        ]
      : []),
    {
      id: 'same-theme',
      label: t('sameTheme.title'),
      description: t('sameTheme.menuDescription'),
      icon: <Compass size={16} strokeWidth={1.5} />,
      onSelect: () => setShowSameThemeModal(true),
      testId: 'song-same-theme',
    },
    ...(songHistory.menuItem ? [songHistory.menuItem] : []),
    ...(submitToLibrary.menuItem ? [submitToLibrary.menuItem] : []),
    // Panels only form movable columns on a large screen; on a phone they are
    // a plain stack, so there is nothing to rearrange.
    ...(isLargeScreen ? [editLayoutAction] : []),
  ]

  return (
    <div className="flex flex-col h-full lg:overflow-hidden">
      {/* Header - Back button, title, and action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 lg:gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-2 lg:gap-4 min-w-0">
            <button
              type="button"
              onClick={handleGoBack}
              className="h-8 px-2 rounded-lg hover:bg-hover shrink-0 flex items-center gap-2"
              title="Back (Esc)"
            >
              <ArrowLeft
                size={16}
                strokeWidth={1.5}
                className="text-fg-label"
              />
              <KeyboardShortcutBadge
                shortcut="Escape"
                variant="muted"
                className="hidden sm:inline-block"
              />
            </button>
            <h1 className="text-base font-semibold text-fg truncate">
              {song.title}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pl-1 md:pl-0">
            {song.category?.name && (
              <button
                type="button"
                onClick={handleOpenCategoryDialog}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-hover text-fg-hint"
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
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-hover text-fg-hint tabular-nums"
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
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-hover font-medium text-key"
                title={t('actions.setKeyLine')}
              >
                <Music2 className="w-3 h-3" />
                {song.keyLine}
              </button>
            )}
          </div>
        </div>
        {/* The in-service actions, then the menu — see actionMenuItems. */}
        <div className="flex items-center gap-2 sm:justify-end shrink-0">
          <button
            type="button"
            onClick={handleToggleBookmark}
            aria-pressed={isBookmarked}
            aria-label={
              isBookmarked ? t('bookmarks.remove') : t('bookmarks.add')
            }
            title={isBookmarked ? t('bookmarks.remove') : t('bookmarks.add')}
            data-testid="song-bookmark-toggle"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              isBookmarked ? 'text-bookmark' : 'text-fg-label hover:text-fg'
            }`}
          >
            {isBookmarked ? (
              <Bookmark size={16} strokeWidth={1.5} fill="currentColor" />
            ) : (
              <Bookmark size={16} strokeWidth={1.5} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowAddToScheduleModal(true)}
            aria-label={t('actions.addToSchedule')}
            title={t('actions.addToSchedule')}
            data-testid="song-add-to-schedule"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus text-fg-label hover:text-fg"
          >
            <CalendarPlus size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={handleOpenKeyLineDialog}
            aria-label={t('actions.setKeyLine')}
            title={t('actions.setKeyLine')}
            data-testid="song-set-key-line"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus text-fg-label hover:text-fg"
          >
            <Music size={16} strokeWidth={1.5} />
          </button>
          <ActionMenu
            items={actionMenuItems}
            label={t('actionsMenu.trigger')}
            testId="song-actions-menu"
          />
          {/* Last in the bar: opens the song editor on its slides. */}
          {canEditSong && (
            <button
              type="button"
              onClick={handleEdit}
              data-testid="song-edit"
              title={t('actionsMenu.editDescription')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Pencil size={16} strokeWidth={1.5} />
              {t('preview.edit')}
            </button>
          )}
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
        stackedAsTabs
        className="flex-1 lg:min-h-0"
      />

      {/* The PowerPoint stage has its own previous / next. */}
      {!isLargeScreen && !isPowerpointLayout && (
        <PhoneSlideControls
          testId="song-phone"
          onPrev={handlePrevSlide}
          onNext={handleNextSlide}
          canPrev={canNavigatePrev}
          canNext={canNavigateNext}
          isNavigating={navigateTemporary.isPending}
          isLive={isThisSongLive}
          onHide={handleHidePresentation}
          isHiding={clearTemporary.isPending}
          project={
            previewMode &&
            stagedSlideIndex !== null &&
            stagedSlideIndex !== presentedSlideIndex
              ? {
                  onClick: handleProjectStaged,
                  isPending: presentTemporarySong.isPending,
                }
              : undefined
          }
        />
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

      <SameThemeModal
        isOpen={showSameThemeModal}
        onClose={() => setShowSameThemeModal(false)}
        songId={song.id}
        songTitle={song.title}
      />

      {songHistory.dialog}
      {submitToLibrary.dialog}
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
