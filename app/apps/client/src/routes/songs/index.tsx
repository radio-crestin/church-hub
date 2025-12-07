import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SongList } from '~/features/songs/components'

export const Route = createFileRoute('/songs/')({
  component: SongsPage,
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()

  const handleSongClick = (songId: number) => {
    navigate({ to: '/songs/$songId', params: { songId: String(songId) } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
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
      </div>

      <SongList onSongClick={handleSongClick} />
    </div>
  )
}
