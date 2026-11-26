import { useEffect, useState } from 'react'

import type { VerseCountdown } from './useVerseLoopTimer'

/** Smooth ticks, or one a second when the system asks for less motion. */
function tickMs(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 1000
    : 250
}

/** How much of the countdown has passed, from 0 to 1, kept current. */
export function useCountdownProgress({
  durationMs,
  endsAt,
}: VerseCountdown): number {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), tickMs())
    return () => clearInterval(interval)
  }, [endsAt])

  const left = Math.max(0, endsAt - now)
  return durationMs > 0 ? Math.min(1, 1 - left / durationMs) : 1
}
