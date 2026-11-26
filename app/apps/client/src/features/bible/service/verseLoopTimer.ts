import { fetcher } from '~/utils/fetcher'

/** The timer of a playing verse slideshow (the server's verse-loop.ts). */
export interface VerseLoopTimer {
  /** The list that started it, e.g. `bookmarks`, `topic:12`. */
  slideshow: string | null
  entryIndex: number
  /** The verse's whole reading time at the current speed. */
  durationMs: number
  /** Time left before the next verse goes up, as of sending. */
  remainingMs: number
}

/** The query the timer lives in; the `verse_loop_timer` message keeps it current. */
export const verseLoopTimerQueryKey = ['verseLoopTimer'] as const

export async function getVerseLoopTimer(): Promise<VerseLoopTimer | null> {
  const response = await fetcher<{ data?: VerseLoopTimer | null }>(
    '/api/presentation/verse-loop',
  )
  return response.data ?? null
}
