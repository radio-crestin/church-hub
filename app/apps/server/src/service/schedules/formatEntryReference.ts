import { formatPassageReference } from './formatPassageReference'
import type { VerseteTineriEntryInput } from './types'

/**
 * The reference a program reading is shown with: "Ioan 3:16-18", or for a
 * comma verse list with a gap, the list itself, "Ioan 3:16-18,20".
 */
export function formatEntryReference(entry: VerseteTineriEntryInput): string {
  if (!entry.verseSegments?.length) {
    return formatPassageReference(
      entry.bookName,
      entry.startChapter,
      entry.startVerse,
      entry.endChapter,
      entry.endVerse,
    )
  }

  const runs = entry.verseSegments
    .map(({ startVerse, endVerse }) =>
      startVerse === endVerse ? `${startVerse}` : `${startVerse}-${endVerse}`,
    )
    .join(',')
  return `${entry.bookName} ${entry.startChapter}:${runs}`
}
