import { useTranslation } from 'react-i18next'

import { TrackCard } from './TrackCard'
import type { MusicFile } from '../types'

interface TrackListProps {
  tracks: MusicFile[]
  onPlay: (track: MusicFile) => void
  onAddToQueue: (track: MusicFile) => void
  maxHeight?: string
}

export function TrackList({
  tracks,
  onPlay,
  onAddToQueue,
  maxHeight = '400px',
}: TrackListProps) {
  const { t } = useTranslation('music')

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        {t('files.empty')}
      </div>
    )
  }

  return (
    <div className="w-full overflow-y-auto scrollbar-thin" style={{ maxHeight }}>
      <div className="space-y-1 pr-1">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            onPlay={onPlay}
            onAddToQueue={onAddToQueue}
          />
        ))}
      </div>
    </div>
  )
}
