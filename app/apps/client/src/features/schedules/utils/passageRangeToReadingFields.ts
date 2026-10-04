import type { ParsedPassageRange } from '~/features/bible'
import type { VerseteTineriEntryInput } from '../types'

export type ReadingFields = Omit<
  VerseteTineriEntryInput,
  'personName' | 'translationId'
>

/**
 * The fields a program reading is saved with, taken from a valid parsed
 * reference — including the verse runs of a comma list with a gap, so
 * "Ioan 3:16-18,20" is stored without verse 19.
 */
export function passageRangeToReadingFields(
  parsed: ParsedPassageRange,
): ReadingFields {
  if (
    parsed.status !== 'valid' ||
    !parsed.bookCode ||
    !parsed.bookName ||
    !parsed.startChapter ||
    !parsed.startVerse ||
    !parsed.endChapter ||
    !parsed.endVerse
  ) {
    throw new Error(`Not a valid passage: ${parsed.status}`)
  }

  return {
    bookCode: parsed.bookCode,
    bookName: parsed.bookName,
    startChapter: parsed.startChapter,
    startVerse: parsed.startVerse,
    endChapter: parsed.endChapter,
    endVerse: parsed.endVerse,
    verseSegments: parsed.verseSegments,
  }
}
