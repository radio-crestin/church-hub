import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSongsLastVisited } from '~/features/navigation'
import { usePresentationState } from '~/features/presentation'
import { SongList, SongsSettingsModal } from '~/features/songs/components'
import { openSongWindow } from '~/features/songs/utils/openSongWindow'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface SongsSearchParams {
  q?: string
  fromSong?: boolean
  selectedSongId?: number
  categoryId?: number
  reset?: number
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
    categoryId:
      typeof search.categoryId === 'number'
        ? search.categoryId
        : typeof search.categoryId === 'string'
          ? parseInt(search.categoryId, 10) || undefined
          : undefined,
    reset:
      typeof search.reset === 'number'
        ? search.reset
        : typeof search.reset === 'string'
          ? parseInt(search.reset, 10) || undefined
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
    categoryId,
    reset,
  } = useSearch({
    from: '/songs/',
  })
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [focusTrigger, setFocusTrigger] = useState(0)

  // Handle reset from keyboard shortcut - clear search and trigger focus
  useEffect(() => {
    if (reset) {
      // Clear the reset param and search query from URL
      navigate({
        to: '/songs/',
        search: { q: undefined, categoryId: undefined },
        replace: true,
      })
      // Trigger focus in SongList
      setFocusTrigger((prev) => prev + 1)
    }
  }, [reset, navigate])

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
          categoryId: categoryId || undefined,
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
          q: searchQuery || undefined,
          categoryId: categoryId || undefined,
        },
      })
    }
  }, [presentationState, navigate, searchQuery, fromSong, categoryId])

  const handleSongClick = (songId: number) => {
    navigate({
      to: '/songs/$songId',
      params: { songId: String(songId) },
      search: {
        q: searchQuery || undefined,
        // Mark as internal navigation so back button uses browser history
        internal: true,
      },
    })
  }

  const handleSearchChange = (query: string) => {
    navigate({
      to: '/songs/',
      search: { q: query || undefined, categoryId: categoryId || undefined },
      replace: true,
    })
  }

  const handleCategoryChange = (newCategoryId: number | undefined) => {
    navigate({
      to: '/songs/',
      search: {
        q: searchQuery || undefined,
        categoryId: newCategoryId || undefined,
      },
      replace: true,
    })
  }

  return (
    <PagePermissionGuard permission="songs.view">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-shrink-0 flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                navigate({ to: '/songs/$songId', params: { songId: 'new' } })
              }
              className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('actions.create')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              title={t('settings.title')}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('settings.title')}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <SongList
            onSongClick={handleSongClick}
            onSongMiddleClick={openSongWindow}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            initialSelectedSongId={selectedSongId}
            categoryId={categoryId}
            onCategoryChange={handleCategoryChange}
            focusTrigger={focusTrigger}
          />
        </div>

        <SongsSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </div>
    </PagePermissionGuard>
  )
}
