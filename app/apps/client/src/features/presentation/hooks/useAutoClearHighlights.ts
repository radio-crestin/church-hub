import { useEffect, useMemo, useRef } from 'react'

import { usePresentationState } from './usePresentationState'
import {
  useClearSlideHighlights,
  useSlideHighlights,
} from './useSlideHighlights'

/**
 * Extracts the current slide/verse/entry index from temporary content data.
 * Returns null if no temporary content is present.
 */
function getTemporaryIndex(
  data:
    | {
        currentSlideIndex?: number
        currentVerseIndex?: number
        currentEntryIndex?: number
      }
    | undefined,
): number | null {
  if (!data) return null
  return (
    data.currentSlideIndex ??
    data.currentVerseIndex ??
    data.currentEntryIndex ??
    0
  )
}

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

  // Extract stable values from state to use as dependencies
  const currentSongSlideId = state?.currentSongSlideId ?? null
  const currentQueueItemId = state?.currentQueueItemId ?? null
  const temporaryType = state?.temporaryContent?.type ?? null
  const temporaryData = state?.temporaryContent?.data as
    | {
        currentSlideIndex?: number
        currentVerseIndex?: number
        currentEntryIndex?: number
      }
    | undefined
  const temporaryIndex = useMemo(
    () => getTemporaryIndex(temporaryData),
    [temporaryData],
  )

  // Track previous slide identifiers to detect slide changes
  const prevSlideRef = useRef<{
    songSlideId: number | null
    queueItemId: number | null
    temporaryType: string | null
    temporaryIndex: number | null
    initialized: boolean
  }>({
    songSlideId: null,
    queueItemId: null,
    temporaryType: null,
    temporaryIndex: null,
    initialized: false,
  })

  useEffect(() => {
    const prev = prevSlideRef.current

    // Check if slide changed (not on initial mount)
    const slideChanged =
      prev.initialized &&
      (prev.songSlideId !== currentSongSlideId ||
        prev.queueItemId !== currentQueueItemId ||
        prev.temporaryType !== temporaryType ||
        prev.temporaryIndex !== temporaryIndex)

    if (slideChanged && hasHighlights) {
      clearHighlights.mutate()
    }

    // Update refs
    prevSlideRef.current = {
      songSlideId: currentSongSlideId,
      queueItemId: currentQueueItemId,
      temporaryType,
      temporaryIndex,
      initialized: true,
    }
  }, [
    currentSongSlideId,
    currentQueueItemId,
    temporaryType,
    temporaryIndex,
    hasHighlights,
    clearHighlights,
  ])
}
