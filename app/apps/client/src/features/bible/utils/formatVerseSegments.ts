import type { VerseSegment } from './parseVerseList'

/** Writes verse runs back the way people type them: "16-18,20". */
export function formatVerseSegments(segments: VerseSegment[]): string {
  return segments
    .map(({ startVerse, endVerse }) =>
      startVerse === endVerse ? `${startVerse}` : `${startVerse}-${endVerse}`,
    )
    .join(',')
}
