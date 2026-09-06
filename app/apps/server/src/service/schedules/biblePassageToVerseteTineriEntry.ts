import type { BiblePassageInput, VerseteTineriEntryInput } from './types'

/**
 * Turns a Bible passage input into the single "Versete Biblice" entry that now
 * represents it.
 *
 * The two Bible item types in a program were merged into one: a passage is no
 * longer its own `bible_passage` item stepped verse by verse, it is one
 * `versete_tineri` slide holding the whole passage. The passage input already
 * carries every structured field an entry needs, so the conversion is lossless
 * — only the person name is empty, because a passage picked from the Bible has
 * nobody attached to it.
 */
export function biblePassageToVerseteTineriEntry(
  passage: BiblePassageInput,
): VerseteTineriEntryInput {
  return {
    personName: '',
    translationId: passage.translationId,
    bookCode: passage.bookCode,
    bookName: passage.bookName,
    startChapter: passage.startChapter,
    startVerse: passage.startVerse,
    endChapter: passage.endChapter,
    endVerse: passage.endVerse,
  }
}
