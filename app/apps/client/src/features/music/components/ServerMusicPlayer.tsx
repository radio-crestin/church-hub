import { Shuffle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'
import { ProgressBar } from './ProgressBar'
import { QueueList } from './QueueList'
import { VolumeSlider } from './VolumeSlider'
import type { QueueItem, ServerPlayerState } from '../types'

interface PlayerProps {
  state: ServerPlayerState
  currentTrack: QueueItem | null
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onSeekCommit?: (time: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onClearQueue: () => void
  onPlayAtIndex: (index: number) => void
  onRemoveFromQueue: (itemId: number) => void
  onToggleShuffle: () => void
}

export function Player({
  state,
  currentTrack,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onSeekCommit,
  onVolumeChange,
  onToggleMute,
  onClearQueue,
  onPlayAtIndex,
  onRemoveFromQueue,
  onToggleShuffle,
}: PlayerProps) {
  const { t } = useTranslation('music')

  return (
    <div className="w-full min-w-0 flex flex-col overflow-hidden lg:flex-1 lg:min-h-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 w-full">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white flex-1 min-w-0 truncate">
            {t('player.title')}
          </h3>
          <VolumeSlider
            volume={state.volume / 100}
            isMuted={state.isMuted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
          />
        </div>
      </div>
      <div className="p-3 sm:p-4 space-y-4 flex-shrink-0">
        <NowPlaying currentTrack={currentTrack} />

        <ProgressBar
          currentTime={state.currentTime}
          duration={state.duration}
          onSeek={onSeek}
          onSeekCommit={onSeekCommit}
        />

        <div className="flex justify-center">
          <PlayerControls
            isPlaying={state.isPlaying}
            isShuffled={state.isShuffled}
            canPlayPrevious={state.currentIndex > 0}
            canPlayNext={
              state.isShuffled || state.currentIndex < state.queueLength - 1
            }
            onPlayPause={onPlayPause}
            onPrevious={onPrevious}
            onNext={onNext}
            onShuffle={onToggleShuffle}
            hideShuffle
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-1 lg:min-h-0 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-3 sm:p-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('player.queue')}
            </span>
            <button
              type="button"
              onClick={onToggleShuffle}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                state.isShuffled
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              title={t('player.shuffle')}
            >
              <Shuffle className="h-4 w-4" />
            </button>
          </div>
          {state.queueLength > 0 && (
            <button
              type="button"
              onClick={onClearQueue}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              title={t('player.clearQueue')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto px-3 sm:px-4 pb-4 scrollbar-thin">
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
