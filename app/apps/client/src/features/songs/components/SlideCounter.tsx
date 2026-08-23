import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SlideCounterProps {
  /** Zero-based index of the slide in focus, or null when there is none. */
  currentIndex: number | null
  /** How many slides the song has, after chorus expansion. */
  total: number
  /**
   * Match the stage clock: a dark pill with an icon, for the stage footer where
   * the two sit on the same row. Off elsewhere, where the counter is one more
   * item in a toolbar rather than an overlay on the stage.
   */
  variant?: 'plain' | 'badge'
  className?: string
}

/**
 * "3 / 12" — where the operator is inside the song.
 *
 * Shown next to the slide-list actions in the classic layout and beside the
 * stage clock in PowerPoint mode, so the position is readable without counting
 * thumbnails. Renders nothing for a song with no slides.
 */
export function SlideCounter({
  currentIndex,
  total,
  variant = 'plain',
  className = '',
}: SlideCounterProps) {
  const { t } = useTranslation('songs')

  if (total <= 0) return null

  const current = currentIndex === null ? null : currentIndex + 1
  const label = `${current ?? '–'} / ${total}`
  const description = t('preview.slideCounter', {
    current: current ?? '–',
    total,
  })

  if (variant === 'badge') {
    return (
      <div
        data-testid="slide-counter"
        title={description}
        aria-label={description}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-gray-900/80 px-2.5 py-1 font-mono text-sm tabular-nums text-white shadow-md backdrop-blur-sm dark:bg-white/85 dark:text-gray-900 ${className}`}
      >
        <Layers size={14} />
        {label}
      </div>
    )
  }

  return (
    <span
      data-testid="slide-counter"
      title={description}
      aria-label={description}
      className={`text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  )
}
