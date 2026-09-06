import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, MoreHorizontal, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFocusSearchEvent } from '~/features/keyboard-shortcuts/utils'
import { getSongsLastVisited } from '~/features/navigation'
import { usePresentationState } from '~/features/presentation'
import type { ScheduleItem } from '~/features/schedules'
import {
  AddSongToScheduleModal,
  getSchedulePassageTarget,
  SchedulePanel,
} from '~/features/schedules'
import { DiscoverButton } from '~/features/song-discovery'
import { SongBookmarksPanel, SongList } from '~/features/songs/components'
import { useSearchHistoryById, useSongBookmarks } from '~/features/songs/hooks'
import { openSongWindow } from '~/features/songs/utils/openSongWindow'
import type { WorkspaceLayout, WorkspacePanel } from '~/features/workspace'
import { useEditLayoutAction, Workspace } from '~/features/workspace'
import { usePersistedBoolean } from '~/hooks/usePersistedBoolean'
import { ActionMenu } from '~/ui/menu'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'
import { PermissionGate } from '~/ui/PermissionGate'

/**
 * The songs page opens as the list beside the Marcaje / Programe stack. From
 * there the operator can drag either panel anywhere — under the list, into its
 * own column, or above the other.
 */
const SONGS_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['list'] },
    { id: 'col-2', panelIds: ['bookmarks', 'schedules'] },
  ],
}

interface SongsSearchParams {
  q?: string
  fromSong?: boolean
  selectedSongId?: number
  reset?: number
  focus?: boolean
  aiSearchId?: number
}

export const Route = createFileRoute('/songs/')({
  component: SongsPage,
  validateSearch: (search: Record<string, unknown>): SongsSearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    fromSong: search.fromSong === true || search.fromSong === 'true',
    selectedSongId:
      typeof search.selectedSongId === 'number'
        ? search.selectedSongId
        : typeof search.selectedSongId === 'string'
          ? parseInt(search.selectedSongId, 10) || undefined
          : undefined,
    reset:
      typeof search.reset === 'number'
        ? search.reset
        : typeof search.reset === 'string'
          ? parseInt(search.reset, 10) || undefined
          : undefined,
    focus: search.focus === true || search.focus === 'true',
    aiSearchId:
      typeof search.aiSearchId === 'number'
        ? search.aiSearchId
        : typeof search.aiSearchId === 'string'
          ? parseInt(search.aiSearchId, 10) || undefined
          : undefined,
  }),
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const { t: tCommon } = useTranslation('common')
  const { t: tSchedules } = useTranslation('schedules')
  const navigate = useNavigate()
  const {
    q: searchQuery = '',
    fromSong,
    selectedSongId,
    reset,
    focus,
    aiSearchId,
  } = useSearch({
    from: '/songs/',
  })
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [bookmarkSongIds, setBookmarkSongIds] = useState<number[]>([])
  const [focusTrigger, setFocusTrigger] = useState(0)
  // The row the operator has highlighted in the list — what the Programe
  // panel's "+" acts on.
  const [selectedSong, setSelectedSong] = useState<{
    id: number
    title: string
  } | null>(null)
  // Both side panels are collapsible here, exactly as on the song page, and
  // remember their state across visits.
  const [bookmarksOpen, setBookmarksOpen] = usePersistedBoolean(
    'songs-list:bookmarks-open',
    true,
  )
  const [schedulesOpen, setSchedulesOpen] = usePersistedBoolean(
    'songs-list:schedules-open',
    false,
  )
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  // Build URL path for search history storage
  const urlPath = useMemo(() => {
    return searchQuery ? `/songs/?q=${encodeURIComponent(searchQuery)}` : null
  }, [searchQuery])

  // Fetch search history by ID when aiSearchId is present
  const { data: searchHistoryData } = useSearchHistoryById(aiSearchId)
  const { data: bookmarks = [] } = useSongBookmarks()

  // Get AI results from history if available (only for AI searches)
  const initialAIResults = useMemo(() => {
    if (
      searchHistoryData?.searchType === 'ai' &&
      searchHistoryData?.aiResults
    ) {
      return searchHistoryData.aiResults
    }
    return undefined
  }, [searchHistoryData])

  // Handle when AI search is saved - update URL with the aiSearchId
  const handleAISearchSaved = useCallback(
    (savedId: number) => {
      navigate({
        to: '/songs/',
        search: {
          q: searchQuery || undefined,
          aiSearchId: savedId,
        },
        replace: true,
      })
    },
    [navigate, searchQuery],
  )

  // Listen for focus events from keyboard shortcuts when already on this route
  useFocusSearchEvent(
    '/songs',
    useCallback(() => {
      setFocusTrigger((prev) => prev + 1)
    }, []),
  )

  // Handle focus from keyboard shortcut - trigger focus on search input
  useEffect(() => {
    if (reset || focus) {
      // Clear the reset/focus param from URL
      navigate({
        to: '/songs/',
        search: {
          q: reset ? undefined : searchQuery || undefined,
        },
        replace: true,
      })
      // Trigger focus in SongList
      setFocusTrigger((prev) => prev + 1)
    }
  }, [reset, focus, navigate, searchQuery])

  const { data: presentationState } = usePresentationState()
  const hasNavigatedOnOpen = useRef(false)

  // Auto-navigate to presented song or last visited song on initial page open
  useEffect(() => {
    if (hasNavigatedOnOpen.current) return

    // Skip auto-navigation when coming back from a song
    // Set flag to prevent re-evaluation when search query changes
    if (fromSong) {
      hasNavigatedOnOpen.current = true
      return
    }

    // Wait for presentation state to load before making navigation decisions
    if (presentationState === undefined) return

    // Priority 1: Navigate to currently presented song
    if (presentationState?.temporaryContent?.type === 'song') {
      const presentedSongId = presentationState.temporaryContent.data.songId
      hasNavigatedOnOpen.current = true
      navigate({
        to: '/songs/$songId',
        params: { songId: String(presentedSongId) },
        search: {
          q: searchQuery || undefined,
        },
      })
      return
    }

    // Priority 2: Navigate to last visited song (if no song is being presented)
    const lastVisited = getSongsLastVisited()
    if (lastVisited?.songId) {
      hasNavigatedOnOpen.current = true
      navigate({
        to: '/songs/$songId',
        params: { songId: String(lastVisited.songId) },
        search: {
          q: lastVisited.searchQuery || searchQuery || undefined,
        },
      })
    }
  }, [presentationState, navigate, searchQuery, fromSong])

  const handleSongClick = (songId: number) => {
    navigate({
      to: '/songs/$songId',
      params: { songId: String(songId) },
      search: {
        q: searchQuery || undefined,
        aiSearchId: aiSearchId || undefined,
      },
    })
  }

  const handleSearchChange = (query: string) => {
    // Clear aiSearchId when search query changes
    navigate({
      to: '/songs/',
      search: { q: query || undefined },
      replace: true,
    })
  }

  // Track screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 1024)
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

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

  const handleAddAllToSchedule = useCallback((songIds: number[]) => {
    setBookmarkSongIds(songIds)
    setShowAddToScheduleModal(true)
  }, [])

  const handleOpenSchedule = useCallback(
    (scheduleId: number) => {
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(scheduleId) },
      })
    },
    [navigate],
  )

  /**
   * "Vezi si versete" is on and a verse row was clicked — jump into the Bible
   * module at that exact passage, selected but not projected.
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

  const presentedSong =
    presentationState?.temporaryContent?.type === 'song'
      ? presentationState.temporaryContent.data
      : null
  const presentedSongId = presentedSong?.songId ?? null

  const handleFocusPresentedSong = useCallback(() => {
    if (presentedSongId) {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(presentedSongId) },
        search: { q: searchQuery || undefined },
      })
    }
  }, [presentedSongId, navigate, searchQuery])

  // Marcaje and Programe are desktop-only: the list needs the whole width on a
  // phone. Both accept songs dragged straight out of the list.
  const workspacePanels: WorkspacePanel[] = [
    {
      id: 'list',
      title: t('title'),
      render: () => (
        <SongList
          onSongClick={handleSongClick}
          onSongMiddleClick={openSongWindow}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          initialSelectedSongId={selectedSongId}
          focusTrigger={focusTrigger}
          initialAIResults={initialAIResults}
          aiSearchId={aiSearchId}
          urlPath={urlPath ?? undefined}
          onAISearchSaved={handleAISearchSaved}
          onSelectedSongChange={setSelectedSong}
          songsDraggable
        />
      ),
    },
    {
      id: 'bookmarks',
      title: t('bookmarks.title'),
      available: isLargeScreen,
      collapsed: !bookmarksOpen,
      render: () => (
        <SongBookmarksPanel
          onSelectSong={handleBookmarkSongClick}
          onAddAllToSchedule={handleAddAllToSchedule}
          acceptsSongDrop
          isCollapsed={!bookmarksOpen}
          onToggleCollapse={() => setBookmarksOpen(!bookmarksOpen)}
        />
      ),
    },
    {
      id: 'schedules',
      title: tSchedules('panel.title'),
      available: isLargeScreen,
      collapsed: !schedulesOpen,
      render: () => (
        <SchedulePanel
          onSelectSong={handleScheduleSongClick}
          onSelectPassage={handleSchedulePassageClick}
          onOpenSchedule={handleOpenSchedule}
          candidateSong={selectedSong}
          acceptsSongDrop
          onAddAllBookmarks={
            bookmarks.length > 0
              ? () => handleAddAllToSchedule(bookmarks.map((b) => b.songId))
              : undefined
          }
          isCollapsed={!schedulesOpen}
          onToggleCollapse={() => setSchedulesOpen(!schedulesOpen)}
        />
      ),
    },
  ]

  const editLayoutAction = useEditLayoutAction('songs-list')

  return (
    <PagePermissionGuard permission="songs.view">
      <div className="flex flex-col min-h-0 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            {presentedSongId && (
              <button
                type="button"
                onClick={handleFocusPresentedSong}
                className="flex items-center gap-2 px-3 py-2 lg:px-3 text-sm bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700 rounded-lg transition-colors"
                title={t('bookmarks.focusPresentedSong')}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline truncate max-w-[200px]">
                  {presentedSong?.title}
                </span>
              </button>
            )}
            {/* Discovering + importing from external sources is a create
                operation — same gate as the create button, same route guard.
                The button animates while the background catalog check runs and
                shows a count once new songs are found. */}
            <PermissionGate permission="songs.create">
              <DiscoverButton />
            </PermissionGate>
            {/* Creating songs requires songs.create — hide the button entirely
                for users without it (the /songs/new route is guarded too). */}
            <PermissionGate permission="songs.create">
              <button
                type="button"
                onClick={() =>
                  navigate({ to: '/songs/$songId', params: { songId: 'new' } })
                }
                className="flex items-center gap-2 px-3 py-2 lg:px-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('actions.create')}</span>
              </button>
            </PermissionGate>
            {/* Panels only form movable columns on a large screen. */}
            <ActionMenu
              items={isLargeScreen ? [editLayoutAction] : []}
              label={tCommon('actionsMenu.trigger')}
              triggerIcon={<MoreHorizontal size={16} />}
              testId="songs-actions-menu"
            />
          </div>
        </div>

        <Workspace
          id="songs-list"
          panels={workspacePanels}
          defaultLayout={SONGS_WORKSPACE_LAYOUT}
          defaultColumnSizes={['70%', '30%']}
          stacked={!isLargeScreen}
          className="flex-1 min-h-0"
        />

        <AddSongToScheduleModal
          isOpen={showAddToScheduleModal}
          songIds={bookmarkSongIds}
          onClose={() => setShowAddToScheduleModal(false)}
        />
      </div>
    </PagePermissionGuard>
  )
}
