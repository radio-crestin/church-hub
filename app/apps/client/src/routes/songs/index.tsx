import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { useQueue } from '~/features/queue'
import { SongList, SongsSettingsModal } from '~/features/songs/components'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface SongsSearchParams {
  q?: string
}

export const Route = createFileRoute('/songs/')({
  component: SongsPage,
  validateSearch: (search: Record<string, unknown>): SongsSearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()
  const { q: searchQuery = '' } = useSearch({ from: '/songs/' })
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const { data: presentationState } = usePresentationState()
  const { data: queue } = useQueue()

  // Auto-navigate to presented song on page open
  useEffect(() => {
    if (!presentationState) return

    let presentedSongId: number | null = null

    // Check temporary content first (priority)
    if (presentationState.temporaryContent?.type === 'song') {
      presentedSongId = presentationState.temporaryContent.data.songId
    }
    // Check queue-based presentation
    else if (presentationState.currentQueueItemId && queue) {
      const currentItem = queue.find(
        (item) => item.id === presentationState.currentQueueItemId,
      )
      if (currentItem?.itemType === 'song' && currentItem.songId) {
        presentedSongId = currentItem.songId
      }
    }

    if (presentedSongId) {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(presentedSongId) },
        search: { q: searchQuery || undefined },
      })
    }
  }, [presentationState, queue, navigate, searchQuery])

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate({ to: '/songs/$songId', params: { songId: 'new' } })
              }
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('actions.create')}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 transition-colors"
              title={t('settings.title')}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <SongList
          onSongClick={handleSongClick}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
        />

        <SongsSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </div>
    </PagePermissionGuard>
  )
}
