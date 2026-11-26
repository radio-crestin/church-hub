import { useCallback, useEffect, useRef, useState } from 'react'

import { calculateMaxExitAnimationDuration } from '../components/rendering/utils/calculateMaxExitAnimationDuration'
import type { ContentType, ContentTypeConfig } from '../types'

// Extra buffer time after animation completes before transitioning to empty state (ms)
const EXIT_ANIMATION_BUFFER = 200

/**
 * Times the content's exit: while `isExiting`, the renderer is told the
 * content is no longer visible, so every text element plays its fade out over
 * the slide it still draws; once the slowest fade (plus a short buffer) is
 * over, `clear` empties the content. Used when the presentation is hidden and
 * when the content ends (stopped, or an empty item), so the slide always fades
 * out instead of cutting to the empty screen. A new slide cancels the exit.
 */
export function useContentExit(
  configs: Partial<Record<ContentType, ContentTypeConfig>> | undefined,
  clear: () => void,
) {
  const [isExiting, setIsExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const configsRef = useRef(configs)
  const clearRef = useRef(clear)

  useEffect(() => {
    configsRef.current = configs
    clearRef.current = clear
  })

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  /** Starts fading out content of `contentType`, unless already fading. */
  const beginExit = useCallback((contentType: ContentType) => {
    if (timerRef.current) return
    setIsExiting(true)
    const delay =
      calculateMaxExitAnimationDuration(configsRef.current?.[contentType]) +
      EXIT_ANIMATION_BUFFER
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setIsExiting(false)
      clearRef.current()
    }, delay)
  }, [])

  const cancelExit = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setIsExiting(false)
  }, [])

  return { isExiting, beginExit, cancelExit }
}
