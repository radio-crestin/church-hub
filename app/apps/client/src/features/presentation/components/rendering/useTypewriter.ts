import { useEffect, useMemo, useRef, useState } from 'react'

import { msPerCharacter } from './utils/msPerCharacter'
import { revealAfter, type TypewriterReveal } from './utils/revealAfter'
import { typedSpans } from './utils/typedSpans'

interface UseTypewriterOptions {
  text: string
  /** The slide this one replaced: lines it showed too are not typed again. */
  previousText?: string
  /** The longest the whole text may take to type. */
  maxDurationMs: number
  /** Types while true; false shows the whole text at once. */
  active: boolean
}

/**
 * Types a slide's text in, left to right, from the moment it mounts, at a
 * pace that fits the text into `maxDurationMs`. Returns what is still hidden,
 * or null once everything shows.
 */
export function useTypewriter({
  text,
  previousText,
  maxDurationMs,
  active,
}: UseTypewriterOptions): TypewriterReveal | null {
  const spans = useMemo(
    () => typedSpans(text, previousText),
    [text, previousText],
  )
  const length = spans.reduce((sum, [start, end]) => sum + end - start, 0)
  const [typed, setTyped] = useState(0)
  // The clock starts once and keeps running if the text is edited mid-way.
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active || length === 0) return
    const perCharacter = msPerCharacter(length, maxDurationMs)
    let frame = 0
    const tick = (now: number) => {
      startedAtRef.current ??= now
      const count = Math.min(
        length,
        Math.floor((now - startedAtRef.current) / perCharacter),
      )
      setTyped(count)
      if (count < length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, length, maxDurationMs])

  return active ? revealAfter(spans, typed) : null
}
