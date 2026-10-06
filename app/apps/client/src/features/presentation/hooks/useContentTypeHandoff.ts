import { useEffect, useRef, useState } from 'react'

import { calculateMaxExitAnimationDuration } from '../components/rendering/utils/calculateMaxExitAnimationDuration'
import type { ContentType, ContentTypeConfig } from '../types'

/** A beat after the slowest fade, so the old text is fully gone before the new mounts. */
const HANDOFF_BUFFER_MS = 50

export interface ShownContent<Data, Next> {
  contentType: ContentType
  contentData: Data
  contentKey: string
  nextSlideData: Next
}

/** A song's first, middle and last slides are one family: they change as slides. */
function family(contentType: ContentType): string {
  return contentType.startsWith('song') ? 'song' : contentType
}

function isTypeChange(from: ContentType, to: ContentType): boolean {
  return from !== 'empty' && to !== 'empty' && family(from) !== family(to)
}

/**
 * When the content changes type while on screen (a song, then a Bible verse),
 * keeps showing the old content, invisible, for the length of its exit fade,
 * then hands over to the new content, which fades in. Without this the old
 * text vanished at once and the new one cut in.
 */
export function useContentTypeHandoff<Data, Next>(
  target: ShownContent<Data, Next>,
  isVisible: boolean,
  configs: Partial<Record<ContentType, unknown>> | undefined,
): ShownContent<Data, Next> & { isVisible: boolean } {
  const [leaving, setLeaving] = useState<ShownContent<Data, Next> | null>(null)
  const shownRef = useRef(target)
  const targetRef = useRef(target)
  const wasVisibleRef = useRef(isVisible)
  const configsRef = useRef(configs)

  const startsHandoff =
    !leaving &&
    isVisible &&
    wasVisibleRef.current &&
    isTypeChange(shownRef.current.contentType, target.contentType)
  if (startsHandoff) setLeaving(shownRef.current)

  const handingOff = leaving ?? (startsHandoff ? shownRef.current : null)

  useEffect(() => {
    if (!leaving) return
    const config = configsRef.current?.[leaving.contentType] as
      | ContentTypeConfig
      | undefined
    const handOver = () => {
      shownRef.current = targetRef.current
      setLeaving(null)
    }
    const timer = setTimeout(
      handOver,
      calculateMaxExitAnimationDuration(config) + HANDOFF_BUFFER_MS,
    )
    return () => clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    configsRef.current = configs
    targetRef.current = target
    wasVisibleRef.current = isVisible
    if (!handingOff) shownRef.current = target
  })

  if (handingOff) return { ...handingOff, isVisible: false }
  return { ...target, isVisible }
}
