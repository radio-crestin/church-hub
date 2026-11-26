import { useEffect, useRef, useState } from 'react'

import { calculateMaxExitAnimationDuration } from '../components/rendering/utils/calculateMaxExitAnimationDuration'
import type { ContentType, ContentTypeConfig } from '../types'
import { contentFamily } from '../utils/contentFamily'

export interface ShownContent<Data, Next> {
  contentType: ContentType
  contentData: Data
  contentKey: string
  nextSlideData: Next
}

function isTypeChange(from: ContentType, to: ContentType): boolean {
  return (
    from !== 'empty' &&
    to !== 'empty' &&
    contentFamily(from) !== contentFamily(to)
  )
}

/**
 * When the content changes type while on screen (a song, then a Bible verse),
 * hands the old content back as `leaving` for the length of its exit fade
 * (ScreenContentLayers draws it), and keeps the new content hidden until it
 * is gone: the old type fades out, then the new one fades in, so the two are
 * never on screen together.
 */
export function useContentTypeHandoff<Data, Next>(
  target: ShownContent<Data, Next>,
  isVisible: boolean,
  configs: Partial<Record<ContentType, unknown>> | undefined,
): ShownContent<Data, Next> & {
  isVisible: boolean
  leaving: ShownContent<Data, Next> | null
} {
  const [leaving, setLeaving] = useState<ShownContent<Data, Next> | null>(null)
  const [last, setLast] = useState({
    contentType: target.contentType,
    isVisible,
  })
  const shownRef = useRef(target)
  const configsRef = useRef(configs)

  // Derived during render, so the old content never leaves the page for a
  // frame between the change and its exit.
  let leavingNow = leaving
  if (last.contentType !== target.contentType || last.isVisible !== isVisible) {
    if (
      isVisible &&
      last.isVisible &&
      isTypeChange(last.contentType, target.contentType)
    ) {
      leavingNow = shownRef.current
      setLeaving(leavingNow)
    }
    setLast({ contentType: target.contentType, isVisible })
  }

  useEffect(() => {
    if (!leaving) return
    const config = configsRef.current?.[leaving.contentType] as
      | ContentTypeConfig
      | undefined
    const timer = setTimeout(
      () => setLeaving(null),
      calculateMaxExitAnimationDuration(config),
    )
    return () => clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    configsRef.current = configs
    shownRef.current = target
  })

  return { ...target, isVisible: isVisible && !leavingNow, leaving: leavingNow }
}
