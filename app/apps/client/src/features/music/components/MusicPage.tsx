import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { FolderBrowser } from './FolderBrowser'
import { ServerMusicPlayer } from './ServerMusicPlayer'
import { VolumeSlider } from './VolumeSlider'
import { useServerAudioPlayer } from '../hooks'
import type { MusicFile } from '../types'

export function MusicPage() {
  const { t } = useTranslation('music')
  const player = useServerAudioPlayer()

  const handlePlayTrack = useCallback(
    (track: MusicFile) => {
      player.playFile(track.id)
    },
    [player],
  )

  const handleAddToQueue = useCallback(
    (tracks: MusicFile | MusicFile[]) => {
      const trackArray = Array.isArray(tracks) ? tracks : [tracks]
      const fileIds = trackArray.map((track) => track.id)
      player.addToQueue(fileIds)
    },
    [player],
  )

  return (
    <div className="h-full overflow-auto p-4 md:p-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('title')}
        </h1>
        <VolumeSlider
          volume={player.state.volume / 100}
          isMuted={player.state.isMuted}
          onVolumeChange={player.setVolume}
          onToggleMute={player.toggleMute}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FolderBrowser
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
          />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <ServerMusicPlayer
              state={player.state}
              currentTrack={player.currentTrack}
              onPlayPause={player.togglePlayPause}
              onPrevious={player.previous}
              onNext={player.next}
              onSeek={player.seek}
              onClearQueue={player.clearQueue}
              onPlayAtIndex={player.playAtIndex}
              onRemoveFromQueue={player.removeFromQueue}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
