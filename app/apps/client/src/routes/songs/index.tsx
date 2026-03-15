import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, GripVertical, Plus, Settings } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFocusSearchEvent } from '~/features/keyboard-shortcuts/utils'
import { getSongsLastVisited } from '~/features/navigation'
import { usePresentationState } from '~/features/presentation'
import { AddSongToScheduleModal } from '~/features/schedules'
import {
  SongBookmarksPanel,
  SongList,
  SongsSettingsModal,
} from '~/features/songs/components'
import { useSearchHistoryById } from '~/features/songs/hooks'
import { openSongWindow } from '~/features/songs/utils/openSongWindow'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [bookmarkSongIds, setBookmarkSongIds] = useState<number[]>([])
  const [focusTrigger, setFocusTrigger] = useState(0)
  const [dividerPosition, setDividerPosition] = useState(() => {
    const stored = localStorage.getItem('songs-bookmarks-divider')
    return stored ? Number(stored) : 75
  })
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Build URL path for search history storage
  const urlPath = useMemo(() => {
    return searchQuery ? `/songs/?q=${encodeURIComponent(searchQuery)}` : null
  }, [searchQuery])

  // Fetch search history by ID when aiSearchId is present
  const { data: searchHistoryData } = useSearchHistoryById(aiSearchId)

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

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newPos = ((moveEvent.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(85, Math.max(50, newPos))
      setDividerPosition(clamped)
      localStorage.setItem('songs-bookmarks-divider', String(clamped))
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
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              title={t('settings.title')}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('settings.title')}</span>
            </button>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 min-h-0 flex flex-row">
          {/* Song List */}
          <div
            className="min-h-0 h-full overflow-hidden"
            style={
              isLargeScreen
                ? { width: `calc(${dividerPosition}% - 4px)` }
                : { flex: 1, minWidth: 0 }
            }
          >
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
            />
          </div>

          {/* Draggable Divider */}
          <div
            className="hidden lg:flex items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
            onMouseDown={handleDividerMouseDown}
          >
            <GripVertical
              size={16}
              className="text-gray-400 group-hover:text-indigo-500 transition-colors"
            />
          </div>

          {/* Bookmarks Panel */}
          <div
            className="overflow-hidden h-full hidden lg:block"
            style={
              isLargeScreen
                ? { width: `calc(${100 - dividerPosition}% - 4px)` }
                : undefined
            }
          >
            <SongBookmarksPanel
              onSelectSong={handleBookmarkSongClick}
              onAddAllToSchedule={handleAddAllToSchedule}
            />
          </div>
        </div>

        <SongsSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
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
