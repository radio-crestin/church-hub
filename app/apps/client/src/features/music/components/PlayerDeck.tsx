import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MusicSection } from './MusicSection'
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
    <MusicSection
      title={t('player.nowPlaying')}
      actions={
        <VolumeSlider
          volume={state.volume / 100}
          isMuted={state.isMuted}
          onVolumeChange={player.setVolume}
          onToggleMute={player.toggleMute}
        />
      }
      className="flex-shrink-0 group-data-[stuck=true]/pinned:py-2"
      headerClassName="group-data-[stuck=true]/pinned:hidden"
      testId="music-now-playing"
    >
      {state.error && (
        <div className="flex items-start gap-2 rounded-lg bg-field p-2.5 text-sm text-fg">
          <AlertTriangle
            className="h-4 w-4 mt-0.5 shrink-0 text-fg-label"
            strokeWidth={1.5}
          />
          <span>{state.error}</span>
        </div>
      )}
      <div className="space-y-3 group-data-[stuck=true]/pinned:flex group-data-[stuck=true]/pinned:items-center group-data-[stuck=true]/pinned:gap-2 group-data-[stuck=true]/pinned:space-y-0">
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
    </MusicSection>
  )
}
