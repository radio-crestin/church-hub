import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getSongsLastVisited } from '~/features/navigation'
import { usePresentationState } from '~/features/presentation'
import { SongList, SongsSettingsModal } from '~/features/songs/components'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface SongsSearchParams {
  q?: string
  fromSong?: boolean
  selectedSongId?: number
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
  }),
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()
  const {
    q: searchQuery = '',
    fromSong,
    selectedSongId,
  } = useSearch({
    from: '/songs/',
  })
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

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
        search: { q: searchQuery || undefined },
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
        search: { q: searchQuery || undefined },
      })
    }
  }, [presentationState, navigate, searchQuery, fromSong])

  const handleSongClick = (songId: number) => {
    navigate({
      to: '/songs/$songId',
      params: { songId: String(songId) },
      search: { q: searchQuery || undefined },
    })
  }

  const handleSearchChange = (query: string) => {
    navigate({
      to: '/songs/',
      search: { q: query || undefined },
      replace: true,
    })
  }

  return (
    <PagePermissionGuard permission="songs.view">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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

        <SongList
          onSongClick={handleSongClick}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          initialSelectedSongId={selectedSongId}
        />

        <SongsSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </div>
    </PagePermissionGuard>
  )
}
