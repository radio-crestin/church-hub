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
        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
          <Music className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('player.noTrack')}</p>
        </div>
      </div>
    )
  }

  const displayTitle = currentTrack.title || currentTrack.filename

  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
        <Music className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{displayTitle}</p>
        {currentTrack.artist && (
          <p className="text-xs text-muted-foreground truncate">
            {currentTrack.artist}
          </p>
        )}
      </div>
    </div>
  )
}
