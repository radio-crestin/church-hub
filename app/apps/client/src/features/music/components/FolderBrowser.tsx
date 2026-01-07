import { FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AddFolderButton } from './AddFolderButton'
import { FolderCard } from './FolderCard'
import { useMusicFolders } from '../hooks'
import type { MusicFile } from '../types'

interface FolderBrowserProps {
  onPlayTrack: (track: MusicFile) => void
  onAddToQueue: (tracks: MusicFile | MusicFile[]) => void
}

export function FolderBrowser({
  onPlayTrack,
  onAddToQueue,
}: FolderBrowserProps) {
  const { t } = useTranslation('music')
  const { data: folders = [], isLoading } = useMusicFolders()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('folders.title')}
        </h2>
        <AddFolderButton />
      </div>

      {folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
            {t('folders.empty')}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {t('folders.emptyDescription')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onPlayTrack={onPlayTrack}
              onAddToQueue={onAddToQueue}
            />
          ))}
        </div>
      )}
    </div>
  )
}
