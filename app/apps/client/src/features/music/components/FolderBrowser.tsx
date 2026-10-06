import { FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '~/ui/page'
import { FolderCard } from './FolderCard'
import { useMusicFolders } from '../hooks'
import type { MusicFile } from '../types'

interface FolderBrowserProps {
  onPlayTrack: (track: MusicFile) => void
  onAddToQueue: (tracks: MusicFile | MusicFile[]) => void
  searchQuery?: string
}

export function FolderBrowser({
  onPlayTrack,
  onAddToQueue,
  searchQuery = '',
}: FolderBrowserProps) {
  const { t } = useTranslation('music')
  const { data: folders = [], isLoading } = useMusicFolders()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={t('folders.empty')}
        hint={t('folders.emptyDescription')}
      />
    )
  }

  return (
    <div className="space-y-3">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          onPlayTrack={onPlayTrack}
          onAddToQueue={onAddToQueue}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  )
}
