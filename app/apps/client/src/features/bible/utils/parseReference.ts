import type { BibleBook } from '../types'

export type ParsedReferenceType = 'book' | 'chapter' | 'verse' | 'none'

export interface ParsedReference {
  type: ParsedReferenceType
  bookName?: string
  chapter?: number
  verse?: number
  matchedBook?: BibleBook
}

export function parseReference(
  query: string,
  books: BibleBook[],
): ParsedReference {
  // Normalize: trim and collapse multiple spaces to single space
  const trimmed = query.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return { type: 'none' }
  }

  // Try to match patterns like "ioan 3 16", "ioan 3:16", "ioan 3", "ioan"
  // Also supports "1 ioan", "2 petru", etc.
  const referencePattern =
    /^(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)\s*(\d+)?(?:[\s:,](\d+))?$/i
  const match = trimmed.match(referencePattern)

  if (!match) {
    return { type: 'none' }
  }

  const [, bookPart, chapterStr, verseStr] = match
  const bookQuery = bookPart.trim().toLowerCase()

  // Find matching book
  const matchedBook = findMatchingBook(bookQuery, books)
  if (!matchedBook) {
    return { type: 'none' }
  }

  const chapter = chapterStr ? parseInt(chapterStr, 10) : undefined
  const verse = verseStr ? parseInt(verseStr, 10) : undefined

  // Validate chapter is within range
  if (chapter !== undefined && chapter > matchedBook.chapterCount) {
    return { type: 'none' }
  }

  if (verse !== undefined && chapter !== undefined) {
    return {
      type: 'verse',
      bookName: matchedBook.bookName,
      chapter,
      verse,
      matchedBook,
    }
  }

  if (chapter !== undefined) {
    return {
      type: 'chapter',
      bookName: matchedBook.bookName,
      chapter,
      matchedBook,
    }
  }

  return {
    type: 'book',
    bookName: matchedBook.bookName,
    matchedBook,
  }
}

function findMatchingBook(
  query: string,
  books: BibleBook[],
): BibleBook | undefined {
  const normalizedQuery = normalizeText(query)

  // First try exact match
  const exactMatch = books.find(
    (book) => normalizeText(book.bookName) === normalizedQuery,
  )
  if (exactMatch) {
    return exactMatch
  }

  // Then try prefix match (e.g., "ioan" matches "Ioan")
  const prefixMatch = books.find((book) =>
    normalizeText(book.bookName).startsWith(normalizedQuery),
  )
  if (prefixMatch) {
    return prefixMatch
  }

  // Try matching book code (e.g., "gen" for Genesis)
  const codeMatch = books.find(
    (book) => normalizeText(book.bookCode) === normalizedQuery,
  )
  if (codeMatch) {
    return codeMatch
  }

  return undefined
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
}
