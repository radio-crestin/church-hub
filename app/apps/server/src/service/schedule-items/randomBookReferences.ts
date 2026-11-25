import { shuffle } from './shuffle'
import { getBookByCode, getChaptersForBook } from '../bible/books'
import type { BibleTopicReference } from '../bible/topics/types'

/** `count` different verses of a book, each as a one-verse reference. */
export function randomBookReferences(
  translationId: number,
  bookCode: string,
  count: number,
): BibleTopicReference[] {
  const book = getBookByCode(translationId, bookCode)
  if (!book) return []
  const all = getChaptersForBook(book.id).flatMap(({ chapter, verseCount }) =>
    Array.from({ length: verseCount }, (_, i) => ({ chapter, verse: i + 1 })),
  )
  return shuffle(all)
    .slice(0, count)
    .map(({ chapter, verse }) => ({
      book: book.bookCode,
      chapter,
      startVerse: verse,
      endVerse: verse,
    }))
}
