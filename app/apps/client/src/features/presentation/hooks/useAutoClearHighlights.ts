import { useEffect, useRef } from 'react'

import { usePresentationState } from './usePresentationState'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from './useSlideHighlights'

/**
 * Hook that automatically clears highlights when the slide changes.
 * Should be used at a global level (e.g., AppLayout) to ensure it works
 * regardless of where the slide change is triggered from.
 */
export function useAutoClearHighlights() {
  const { data: state } = usePresentationState()
  const { data: highlights } = useSlideHighlights()
  const clearHighlights = useClearSlideHighlights()
  const hasHighlights = highlights && highlights.length > 0

  // Track previous slide identifiers to detect slide changes
  const prevSlideRef = useRef<{
    songSlideId: number | null
    queueItemId: number | null
    temporaryIndex: number | null
    initialized: boolean
  }>({
    songSlideId: null,
    queueItemId: null,
    temporaryIndex: null,
    initialized: false,
  })

  useEffect(() => {
    const currentSongSlideId = state?.currentSongSlideId ?? null
    const currentQueueItemId = state?.currentQueueItemId ?? null
    const temporaryIndex = state?.temporaryContent
      ? ((
          state.temporaryContent.data as {
            currentSlideIndex?: number
            currentVerseIndex?: number
            currentEntryIndex?: number
          }
        )?.currentSlideIndex ??
        (state.temporaryContent.data as { currentVerseIndex?: number })
          ?.currentVerseIndex ??
        (state.temporaryContent.data as { currentEntryIndex?: number })
          ?.currentEntryIndex ??
        0)
      : null

    const prev = prevSlideRef.current

    // Check if slide changed (not on initial mount)
    const slideChanged =
      prev.initialized &&
      (prev.songSlideId !== currentSongSlideId ||
        prev.queueItemId !== currentQueueItemId ||
        prev.temporaryIndex !== temporaryIndex)

    if (slideChanged && hasHighlights) {
      clearHighlights.mutate()
    }

    // Update refs
    prevSlideRef.current = {
      songSlideId: currentSongSlideId,
      queueItemId: currentQueueItemId,
      temporaryIndex,
      initialized: true,
    }
  }, [
    state?.currentSongSlideId,
    state?.currentQueueItemId,
    state?.temporaryContent,
    hasHighlights,
    clearHighlights,
  ])
}
