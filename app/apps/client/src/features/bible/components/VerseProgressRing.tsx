import { useTranslation } from 'react-i18next'

import { useCountdownProgress } from '../hooks/useCountdownProgress'
import type { VerseCountdown } from '../hooks/useVerseLoopTimer'

const SIZE = 16
const STROKE = 1.5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface VerseProgressRingProps {
  countdown: VerseCountdown
  testId?: string
}

/**
 * How far the live verse of a playing slideshow is through its reading time:
 * the ring fills, and the next verse goes up when it closes.
 */
export function VerseProgressRing({
  countdown,
  testId,
}: VerseProgressRingProps) {
  const { t } = useTranslation('bible')
  const progress = useCountdownProgress(countdown)
  const percent = Math.round(progress * 100)
  const secondsLeft = Math.ceil((1 - progress) * (countdown.durationMs / 1000))

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={t('slideshow.nextIn', { seconds: secondsLeft })}
      data-testid={testId}
      data-progress={percent}
      className="flex-none -rotate-90"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        className="stroke-line-strong"
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        className="stroke-live motion-safe:transition-[stroke-dashoffset] motion-safe:duration-250 motion-safe:ease-linear"
      />
    </svg>
  )
}
