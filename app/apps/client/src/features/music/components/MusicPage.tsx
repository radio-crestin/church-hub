import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { FolderBrowser } from './FolderBrowser'
import { MusicPlayer } from './MusicPlayer'
import { useAudioPlayer } from '../hooks'
import type { MusicFile, QueueItem } from '../types'

export function MusicPage() {
  const { t } = useTranslation('music')
  const player = useAudioPlayer()

  const handlePlayTrack = useCallback(
    (track: MusicFile) => {
      const queueItem: QueueItem = {
        queueId: crypto.randomUUID(),
        fileId: track.id,
        path: track.path,
        filename: track.filename,
        title: track.title ?? undefined,
        artist: track.artist ?? undefined,
        album: track.album ?? undefined,
        duration: track.duration ?? undefined,
      }
      player.clearQueue()
      player.addToQueue(queueItem)
      player.play()
    },
    [player],
  )

  const handleAddToQueue = useCallback(
    (tracks: MusicFile | MusicFile[]) => {
      const trackArray = Array.isArray(tracks) ? tracks : [tracks]
      const queueItems: QueueItem[] = trackArray.map((track) => ({
        queueId: crypto.randomUUID(),
        fileId: track.id,
        path: track.path,
        filename: track.filename,
        title: track.title ?? undefined,
        artist: track.artist ?? undefined,
        album: track.album ?? undefined,
        duration: track.duration ?? undefined,
      }))
      queueItems.forEach((item) => player.addToQueue(item))
    },
    [player],
  )

  return (
    <div className="h-full overflow-auto p-4 md:p-6 pb-8">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FolderBrowser
            onPlayTrack={handlePlayTrack}
            onAddToQueue={handleAddToQueue}
          />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <MusicPlayer
              state={player.state}
              queue={player.queue}
              currentTrack={player.currentTrack}
              onPlayPause={player.togglePlayPause}
              onPrevious={player.previous}
              onNext={player.next}
              onSeek={player.seek}
              onVolumeChange={player.setVolume}
              onToggleMute={player.toggleMute}
              onShuffle={player.shuffle}
              onReorderQueue={player.reorderQueue}
              onPlayQueueItem={player.playAtIndex}
              onRemoveFromQueue={player.removeFromQueue}
              onClearQueue={player.clearQueue}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
