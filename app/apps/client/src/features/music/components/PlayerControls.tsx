import { Pause, Play, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'

interface PlayerControlsProps {
  isPlaying: boolean
  isShuffled: boolean
  canPlayPrevious: boolean
  canPlayNext: boolean
  onPlayPause: () => void
  onPrevious: () => void
  onNext: () => void
  onShuffle: () => void
  hideShuffle?: boolean
}

export function PlayerControls({
  isPlaying,
  isShuffled,
  canPlayPrevious,
  canPlayNext,
  onPlayPause,
  onPrevious,
  onNext,
  onShuffle,
  hideShuffle = false,
}: PlayerControlsProps) {
  const { t } = useTranslation('music')

  return (
    <div className="flex items-center justify-center gap-2">
      {!hideShuffle && (
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${isShuffled ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
          onClick={onShuffle}
          title={t('player.shuffle')}
        >
          <Shuffle className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onPrevious}
        disabled={!canPlayPrevious}
        title={t('player.previous')}
      >
        <SkipBack className="h-4 w-4" />
      </Button>

      <Button
        variant="default"
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
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  )
}
