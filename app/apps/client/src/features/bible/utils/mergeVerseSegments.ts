import type { VerseSegment } from './parseVerseList'

/**
 * Sorts verse runs and joins the ones that touch or overlap, so
 * "17,16" and "16,17" both become 16-17, and "16-18,20" stays two runs.
 */
export function mergeVerseSegments(segments: VerseSegment[]): VerseSegment[] {
  const sorted = [...segments].sort((a, b) => a.startVerse - b.startVerse)
  const merged: VerseSegment[] = []

  for (const segment of sorted) {
    const last = merged[merged.length - 1]
    if (last && segment.startVerse <= last.endVerse + 1) {
      last.endVerse = Math.max(last.endVerse, segment.endVerse)
    } else {
      merged.push({ ...segment })
    }
  }

  return merged
}
