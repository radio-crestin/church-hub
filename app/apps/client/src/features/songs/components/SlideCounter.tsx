import { useTranslation } from 'react-i18next'

interface SlideCounterProps {
  /** Zero-based index of the slide in focus, or null when there is none. */
  currentIndex: number | null
  /** How many slides the song has, after chorus expansion. */
  total: number
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
  className = '',
}: SlideCounterProps) {
  const { t } = useTranslation('songs')

  if (total <= 0) return null

  const current = currentIndex === null ? null : currentIndex + 1
  const label = `${current ?? '–'} / ${total}`

  return (
    <span
      data-testid="slide-counter"
      title={t('preview.slideCounter', { current: current ?? '–', total })}
      aria-label={t('preview.slideCounter', { current: current ?? '–', total })}
      className={`text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  )
}
