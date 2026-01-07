import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '~/ui/card'
import { Separator } from '~/ui/separator'
import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'
import { Playlist } from './Playlist'
import { ProgressBar } from './ProgressBar'
import { VolumeSlider } from './VolumeSlider'
import type { PlayerState, QueueItem } from '../types'

interface MusicPlayerProps {
  state: PlayerState
  queue: QueueItem[]
  currentTrack: QueueItem | null
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onShuffle: () => void
  onReorderQueue: (items: QueueItem[]) => void
  onPlayQueueItem: (index: number) => void
  onRemoveFromQueue: (index: number) => void
  onClearQueue: () => void
}

export function MusicPlayer({
  state,
  queue,
  currentTrack,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onShuffle,
  onReorderQueue,
  onPlayQueueItem,
  onRemoveFromQueue,
  onClearQueue,
}: MusicPlayerProps) {
  const { t } = useTranslation('music')

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('player.nowPlaying')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <NowPlaying currentTrack={currentTrack} />

        <ProgressBar
          currentTime={state.currentTime}
          duration={state.duration}
          onSeek={onSeek}
        />

        <div className="flex items-center justify-between">
          <PlayerControls
            isPlaying={state.isPlaying}
            isShuffled={state.isShuffled}
            canPlayPrevious={state.currentIndex > 0}
            canPlayNext={state.currentIndex < queue.length - 1}
            onPlayPause={onPlayPause}
            onPrevious={onPrevious}
            onNext={onNext}
            onShuffle={onShuffle}
          />

          <VolumeSlider
            volume={state.volume}
            isMuted={state.isMuted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
          />
        </div>

        <Separator />

        <Playlist
          items={queue}
          currentIndex={state.currentIndex}
          onReorder={onReorderQueue}
          onPlayItem={onPlayQueueItem}
          onRemoveItem={onRemoveFromQueue}
          onClear={onClearQueue}
        />
      </CardContent>
    </Card>
  )
}
