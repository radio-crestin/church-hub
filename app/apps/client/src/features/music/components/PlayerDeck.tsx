import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NowPlaying } from './NowPlaying'
import { PlayerControls } from './PlayerControls'
import { ProgressBar } from './ProgressBar'
import { VolumeSlider } from './VolumeSlider'
import type { ServerAudioPlayer } from '../hooks'

/**
 * What is playing and its controls. Pinned on a phone, it drops its title row
 * and progress bar once the page scrolls, leaving the track and its buttons.
 */
export function PlayerDeck({ player }: { player: ServerAudioPlayer }) {
  const { t } = useTranslation('music')
  const { state } = player

  return (
    <>
      <div className="p-3 sm:p-4 border-b border-line flex-shrink-0 overflow-hidden group-data-[stuck=true]/pinned:hidden">
        <div className="flex items-center gap-2 w-full">
          <h3 className="text-sm sm:text-sm font-semibold text-fg flex-1 min-w-0 truncate">
            {t('player.title')}
          </h3>
          <VolumeSlider
            volume={state.volume / 100}
            isMuted={state.isMuted}
            onVolumeChange={player.setVolume}
            onToggleMute={player.toggleMute}
          />
        </div>
      </div>
      {state.error && (
        <div className="mx-3 sm:mx-4 mt-3 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <div className="p-3 sm:p-4 space-y-4 flex-shrink-0 group-data-[stuck=true]/pinned:flex group-data-[stuck=true]/pinned:items-center group-data-[stuck=true]/pinned:gap-2 group-data-[stuck=true]/pinned:space-y-0 group-data-[stuck=true]/pinned:py-2">
        <div className="min-w-0 group-data-[stuck=true]/pinned:flex-1">
          <NowPlaying currentTrack={player.currentTrack} />
        </div>

        <div className="group-data-[stuck=true]/pinned:hidden">
          <ProgressBar
            currentTime={state.currentTime}
            duration={state.duration}
            onSeek={player.seek}
          />
        </div>

        <div className="flex justify-center shrink-0">
          <PlayerControls
            isPlaying={state.isPlaying}
            canPlayPrevious={state.currentIndex > 0}
            canPlayNext={state.currentIndex < state.queueLength - 1}
            onPlayPause={player.togglePlayPause}
            onPrevious={player.previous}
            onNext={player.next}
          />
        </div>
      </div>
    </>
  )
}
