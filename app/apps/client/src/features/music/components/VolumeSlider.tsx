import { Volume2, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { Slider } from '~/ui/slider'

interface VolumeSliderProps {
  volume: number
  isMuted: boolean
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
}

export function VolumeSlider({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: VolumeSliderProps) {
  const { t } = useTranslation('music')

  const handleVolumeChange = (values: number[]) => {
    onVolumeChange(values[0])
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
        onClick={onToggleMute}
        title={isMuted ? t('player.unmute') : t('player.mute')}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>
      <Slider
        value={[isMuted ? 0 : volume]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={handleVolumeChange}
        showValue={false}
        className="w-24 sm:w-28 md:w-32"
      />
    </div>
  )
}
