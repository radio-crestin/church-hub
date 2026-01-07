import { useTranslation } from 'react-i18next'

import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'
import { Playlist } from './Playlist'
import { ProgressBar } from './ProgressBar'
import type { PlayerState, QueueItem } from '../types'

interface MusicPlayerProps {
  state: PlayerState
  queue: QueueItem[]
  currentTrack: QueueItem | null
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (time: number) => void
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
  onShuffle,
  onReorderQueue,
  onPlayQueueItem,
  onRemoveFromQueue,
  onClearQueue,
}: MusicPlayerProps) {
  const { t } = useTranslation('music')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {t('player.nowPlaying')}
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <NowPlaying currentTrack={currentTrack} />

        <ProgressBar
          currentTime={state.currentTime}
          duration={state.duration}
          onSeek={onSeek}
        />

        <div className="flex justify-center">
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
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <Playlist
            items={queue}
            currentIndex={state.currentIndex}
            onReorder={onReorderQueue}
            onPlayItem={onPlayQueueItem}
            onRemoveItem={onRemoveFromQueue}
            onClear={onClearQueue}
          />
        </div>
      </div>
    </div>
  )
}
