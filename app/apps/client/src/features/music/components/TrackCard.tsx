import { ListPlus, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import type { MusicFile } from '../types'
import { formatDuration } from '../utils'

interface TrackCardProps {
  track: MusicFile
  onPlay: (track: MusicFile) => void
  onAddToQueue: (track: MusicFile) => void
}

export function TrackCard({ track, onPlay, onAddToQueue }: TrackCardProps) {
  const { t } = useTranslation('music')

  const displayTitle = track.title || track.filename

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-700/50 group">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onPlay(track)}
        title={t('files.play')}
      >
        <Play className="h-4 w-4" />
      </Button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
          {displayTitle}
        </p>
        {track.artist && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {track.artist}
          </p>
        )}
      </div>

      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {track.duration ? formatDuration(track.duration) : '--:--'}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onAddToQueue(track)}
        title={t('files.addToQueue')}
      >
        <ListPlus className="h-4 w-4" />
      </Button>
    </div>
  )
}
