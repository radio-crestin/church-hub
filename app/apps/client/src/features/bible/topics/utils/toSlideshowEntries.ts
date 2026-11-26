import type { VerseteTineriEntry } from '~/features/presentation/types'
import type { BibleTopicPassage } from '../types'

/**
 * A topic's passages as slideshow entries: one slide per passage, with its
 * own template if it has one.
 */
export function toSlideshowEntries(
  passages: BibleTopicPassage[],
): VerseteTineriEntry[] {
  return passages.flatMap((passage, index) => {
    const first = passage.verses[0]
    const last = passage.verses[passage.verses.length - 1]
    if (!first || !last) return []
    return [
      {
        id: first.id,
        personName: '',
        reference: passage.reference,
        bookCode: first.bookCode,
        bookName: first.bookName,
        startChapter: passage.chapter,
        startVerse: first.verse,
        endChapter: passage.chapter,
        endVerse: last.verse,
        text: passage.verses.map((verse) => verse.text).join(' '),
        sortOrder: index,
        templateId: passage.templateId,
      },
    ]
  })
}
