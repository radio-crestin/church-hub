import { Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { QueueItem } from '../types'

interface NowPlayingProps {
  currentTrack: QueueItem | null
}

export function NowPlaying({ currentTrack }: NowPlayingProps) {
  const { t } = useTranslation('music')

  if (!currentTrack) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
          <Music className="h-6 w-6 text-gray-400 dark:text-gray-500" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('player.noTrack')}
          </p>
        </div>
      </div>
    )
  }

  const displayTitle = currentTrack.title || currentTrack.filename

  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
        <Music className="h-6 w-6 text-gray-400 dark:text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
          {displayTitle}
        </p>
        {currentTrack.artist && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {currentTrack.artist}
          </p>
        )}
      </div>
    </div>
  )
}
