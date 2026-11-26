import { useEffect, useRef, useState } from 'react'

import { calculateMaxExitAnimationDuration } from '../components/rendering/utils/calculateMaxExitAnimationDuration'
import type { ContentType, ScreenWithConfigs } from '../types'
import { slideKind } from '../utils/slideKind'

export interface ShownContent<Data, Next> {
  contentType: ContentType
  contentData: Data
  contentKey: string
  nextSlideData: Next
  /** The screen as it draws this content: with the template it is shown in */
  screen: ScreenWithConfigs | null | undefined
}

/** A song, then a verse; or the same kind of slide in another template. */
function isNewKindOfSlide(from: string | null, to: string | null): boolean {
  return from !== null && to !== null && from !== to
}

/**
 * When a new kind of slide comes while one is on screen (a song, then a Bible
 * verse, or another template), hands the old one back as `leaving` for the
 * length of its exit fade, drawn with its own template (ScreenContentLayers),
 * and keeps the new content hidden until it is gone: the old slide fades out,
 * then the new one fades in, so the two are never on screen together. A
 * change during the hand-off (the new template finishing loading, another
 * step) leaves the slide that is fading out as it is.
 */
export function useContentTypeHandoff<Data, Next>(
  target: ShownContent<Data, Next>,
  isVisible: boolean,
): ShownContent<Data, Next> & {
  isVisible: boolean
  leaving: ShownContent<Data, Next> | null
} {
  const [leaving, setLeaving] = useState<ShownContent<Data, Next> | null>(null)
  const kind = slideKind(target.contentType, target.screen)
  const [last, setLast] = useState({ kind, isVisible })
  // The last content actually on screen, which a hand-off fades out
  const shownRef = useRef(target)

  // Derived during render, so the old content never leaves the page for a
  // frame between the change and its exit.
  let leavingNow = leaving
  if (last.kind !== kind || last.isVisible !== isVisible) {
    if (
      !leaving &&
      isVisible &&
      last.isVisible &&
      isNewKindOfSlide(last.kind, kind)
    ) {
      leavingNow = shownRef.current
      setLeaving(leavingNow)
    }
    setLast({ kind, isVisible })
  }

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(
      () => setLeaving(null),
      calculateMaxExitAnimationDuration(
        leaving.screen?.contentConfigs[leaving.contentType],
      ),
    )
    return () => clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    if (!leavingNow) shownRef.current = target
  })

  return { ...target, isVisible: isVisible && !leavingNow, leaving: leavingNow }
}
