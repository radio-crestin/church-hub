import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Music, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/songs/')({
  component: SongsPage,
})

function SongsPage() {
  const { t } = useTranslation('songs')
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('title', 'Songs')}
        </h1>
        <button
          type="button"
          onClick={() =>
            navigate({ to: '/songs/$songId', params: { songId: 'new' } })
          }
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('actions.create', 'New Song')}
        </button>
      </div>

      <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <Music
          size={48}
          className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
        />
        <p className="text-gray-600 dark:text-gray-400 font-medium">
          {t('noSongs', 'No songs yet')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          {t('noSongsDescription', 'Create your first song to get started')}
        </p>
      </div>
    </div>
  )
}
