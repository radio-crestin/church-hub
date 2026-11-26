import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'

interface PlayerControlsProps {
  isPlaying: boolean
  canPlayPrevious: boolean
  canPlayNext: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
}

export function PlayerControls({
  isPlaying,
  canPlayPrevious,
  canPlayNext,
  onPlayPause,
  onPrevious,
  onNext,
}: PlayerControlsProps) {
  const { t } = useTranslation('music')

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onPrevious}
        disabled={!canPlayPrevious}
        title={t('player.previous')}
      >
        <SkipBack className="h-4 w-4" strokeWidth={1.5} />
      </Button>

      <Button
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={onPlayPause}
        title={isPlaying ? t('player.pause') : t('player.play')}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onNext}
        disabled={!canPlayNext}
        title={t('player.next')}
      >
        <SkipForward className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  )
}
