import { useTranslation } from 'react-i18next'

import { ScrollArea } from '~/ui/scroll-area'
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
    <ScrollArea className="w-full" style={{ maxHeight }}>
      <div className="space-y-1 pr-4">
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            onPlay={onPlay}
            onAddToQueue={onAddToQueue}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
