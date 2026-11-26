import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Slider } from '~/ui/slider'
import { formatDuration } from '../utils'

interface ProgressBarProps {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

/** How far the player's time may be from a seek and count as there. */
const ARRIVED_SECONDS = 2
/** How long the bar waits for the player to report a seek. */
const ARRIVAL_TIMEOUT_MS = 2000

/**
 * Seeks once, where the drag ends: a seek per step would make the player jump
 * through every second on the way. The thumb stays where it was let go until
 * the player's time gets there, so it never snaps back.
 */
export function ProgressBar({
  currentTime,
  duration,
  onSeek,
}: ProgressBarProps) {
  const { t } = useTranslation('music')
  const [held, setHeld] = useState<{ time: number; sought: boolean } | null>(
    null,
  )

  useEffect(() => {
    if (!held?.sought) return
    if (Math.abs(currentTime - held.time) < ARRIVED_SECONDS) {
      setHeld(null)
      return
    }
    const timer = setTimeout(() => setHeld(null), ARRIVAL_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [currentTime, held])

  const commit = ([time]: number[]) => {
    setHeld({ time, sought: true })
    onSeek(time)
  }

  const shownTime = held?.time ?? currentTime

  return (
    <div className="flex items-center gap-3 w-full">
      <span
        className="text-xs text-fg-hint tabular-nums w-10 text-right"
        data-testid="music-current-time"
      >
        {formatDuration(shownTime)}
      </span>
      <Slider
        value={[shownTime]}
        min={0}
        max={duration || 100}
        step={1}
        onValueChange={([time]) => setHeld({ time, sought: false })}
        onValueCommit={commit}
        className="flex-1"
        showValue={false}
        label={t('player.position')}
        testId="music-progress"
      />
      <span className="text-xs text-fg-hint tabular-nums w-10">
        {formatDuration(duration)}
      </span>
    </div>
  )
}
