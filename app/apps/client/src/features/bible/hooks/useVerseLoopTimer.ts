import { useQuery } from '@tanstack/react-query'

import {
  getVerseLoopTimer,
  verseLoopTimerQueryKey,
} from '../service/verseLoopTimer'

/** A verse's place in its reading time, on this device's clock. */
export interface VerseCountdown {
  entryIndex: number
  durationMs: number
  /** When the next verse goes up (local epoch ms). */
  endsAt: number
}

/**
 * The running timer of the slideshow `slideshow`, or null when it isn't
 * playing. Its time left counts from when this device received it, so a
 * phone whose clock differs from the server's still counts right.
 */
export function useVerseLoopTimer(slideshow: string): VerseCountdown | null {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: verseLoopTimerQueryKey,
    queryFn: getVerseLoopTimer,
  })
  if (!data || data.slideshow !== slideshow) return null
  return {
    entryIndex: data.entryIndex,
    durationMs: data.durationMs,
    endsAt: dataUpdatedAt + data.remainingMs,
  }
}
