/** Words a congregation reads in a minute off a screen, unless set otherwise. */
export const DEFAULT_READING_WORDS_PER_MINUTE = 160

/** No verse leaves the screen sooner than this, however short. */
const MIN_READING_MS = 3000

/**
 * How long a verse stays up in a looping slideshow: its word count at the
 * given reading speed, never less than `MIN_READING_MS`.
 */
export function readingTimeMs(text: string, wordsPerMinute: number): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(MIN_READING_MS, (words * 60_000) / wordsPerMinute)
}
