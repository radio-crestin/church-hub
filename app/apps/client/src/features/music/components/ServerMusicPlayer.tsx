import { useTranslation } from 'react-i18next'

import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'
import { ProgressBar } from './ProgressBar'
import { QueueList } from './QueueList'
import type { QueueItem, ServerPlayerState } from '../types'

interface ServerMusicPlayerProps {
  state: ServerPlayerState
  currentTrack: QueueItem | null
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onClearQueue: () => void
  onPlayAtIndex: (index: number) => void
  onRemoveFromQueue: (itemId: number) => void
}

export function ServerMusicPlayer({
  state,
  currentTrack,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onClearQueue,
  onPlayAtIndex,
  onRemoveFromQueue,
}: ServerMusicPlayerProps) {
  const { t } = useTranslation('music')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('player.nowPlaying')}
          </h3>
          {state.queueLength > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {state.currentIndex + 1} / {state.queueLength}
            </span>
          )}
        </div>
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
            isShuffled={false}
            canPlayPrevious={state.currentIndex > 0}
            canPlayNext={state.currentIndex < state.queueLength - 1}
            onPlayPause={onPlayPause}
            onPrevious={onPrevious}
            onNext={onNext}
            onShuffle={() => {}}
            hideShuffle
          />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('player.queue')}
            </span>
            {state.queueLength > 0 && (
              <button
                type="button"
                onClick={onClearQueue}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                {t('player.clearQueue')}
              </button>
            )}
          </div>
          <QueueList
            queue={state.queue}
            currentIndex={state.currentIndex}
            onPlayAtIndex={onPlayAtIndex}
            onRemoveFromQueue={onRemoveFromQueue}
          />
        </div>
      </div>
    </div>
  )
}
