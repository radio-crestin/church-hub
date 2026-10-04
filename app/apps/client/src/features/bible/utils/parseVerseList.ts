/** A run of verses inside one chapter, both ends included. */
export interface VerseSegment {
  startVerse: number
  endVerse: number
}

const VERSE_RUN = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/

/**
 * Reads the verse part of a reference written as a comma list:
 * "16" → [16], "16,17" → [16, 17], "16-18,20" → [16-18, 20].
 *
 * Returns the runs in the order they were typed, or null when any part is not
 * a verse or a verse range. Order checks are left to the caller, so it can say
 * *why* a reference is wrong.
 */
export function parseVerseList(text: string): VerseSegment[] | null {
  const parts = text.split(',').map((part) => part.trim())
  const segments: VerseSegment[] = []

  for (const part of parts) {
    const match = part.match(VERSE_RUN)
    if (!match) return null
    const startVerse = parseInt(match[1], 10)
    const endVerse = match[2] ? parseInt(match[2], 10) : startVerse
    segments.push({ startVerse, endVerse })
  }

  return segments
}
