import type { VerseteTineriEntryInput } from './types'
import {
  type BibleVerse,
  getVerseRange,
  getVersesAcrossChapters,
} from '../bible'

/**
 * The verses a program reading is made of, in reading order: its range, or
 * for a comma verse list ("Ioan 3:16-18,20") each run of the list, skipping
 * the verses in the gaps.
 */
export function getEntryVerses(entry: VerseteTineriEntryInput): BibleVerse[] {
  if (entry.verseSegments?.length) {
    return entry.verseSegments.flatMap((segment) =>
      getVerseRange(
        entry.translationId,
        entry.bookCode,
        entry.startChapter,
        segment.startVerse,
        segment.endVerse,
      ),
    )
  }

  return entry.startChapter === entry.endChapter
    ? getVerseRange(
        entry.translationId,
        entry.bookCode,
        entry.startChapter,
        entry.startVerse,
        entry.endVerse,
      )
    : getVersesAcrossChapters(
        entry.translationId,
        entry.bookCode,
        entry.startChapter,
        entry.startVerse,
        entry.endChapter,
        entry.endVerse,
      )
}
