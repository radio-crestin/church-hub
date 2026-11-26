import { VerseProgressRing } from './VerseProgressRing'
import { useVerseLoopTimer } from '../hooks/useVerseLoopTimer'

interface VerseProgressSlotProps {
  /** The list whose slideshow this row belongs to (`bookmarks`, `topic:12`). */
  slideshow: string
  /** The row's place in that slideshow. */
  entryIndex: number
  testId?: string
}

/**
 * The progress ring of a list row while its slideshow times it, over the end
 * of the row's first line. It takes no room in the row (its zero width
 * cancels the row's 4px gap), so the text never rewraps as it comes and goes.
 */
export function VerseProgressSlot({
  slideshow,
  entryIndex,
  testId,
}: VerseProgressSlotProps) {
  const countdown = useVerseLoopTimer(slideshow)
  if (countdown?.entryIndex !== entryIndex) return null
  return (
    <span className="relative -ml-1 w-0 flex-none self-stretch">
      <span className="pointer-events-none absolute top-2 right-1">
        <VerseProgressRing
          key={countdown.endsAt}
          countdown={countdown}
          testId={testId}
        />
      </span>
    </span>
  )
}
