import { useEffect, useRef } from 'react'

import { usePresentationState } from '~/features/presentation'
import type { useVerseSlideshow } from '../../hooks/useVerseSlideshow'
import { getVerseSlideshow } from '../../utils/getVerseSlideshow'

/**
 * A topic opened while another topic's slideshow plays (▶ or 🔁) takes it
 * over as soon as its passages load: its first one goes on screen, with its
 * template, and the slideshow goes on in the same mode.
 */
export function useTakeOverTopicSlideshow(
  topicId: number,
  hasPassages: boolean,
  slideshow: ReturnType<typeof useVerseSlideshow>,
) {
  const { data: state } = usePresentationState()
  const settledTopicRef = useRef<number | null>(null)

  useEffect(() => {
    if (!hasPassages || settledTopicRef.current === topicId) return
    settledTopicRef.current = topicId
    const playing = getVerseSlideshow(state)
    const name = playing?.slideshow
    if (!name?.startsWith('topic:') || name === `topic:${topicId}`) return
    if (playing?.loop) slideshow.start('loop')
    else if (playing?.autoAdvance) slideshow.start('once')
  }, [topicId, hasPassages, state, slideshow])
}
