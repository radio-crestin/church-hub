import type { BibleBook } from '../types'

export type PassageParseStatus =
  | 'valid'
  | 'empty'
  | 'invalid_format'
  | 'book_not_found'
  | 'invalid_chapter'
  | 'invalid_verse'
  | 'end_before_start'

export interface ChapterInfo {
  chapter: number
  verseCount: number
}

export interface ParsedPassageRange {
  status: PassageParseStatus
  errorKey?: string
  bookCode?: string
  bookName?: string
  startChapter?: number
  startVerse?: number
  endChapter?: number
  endVerse?: number
  matchedBook?: BibleBook
  formattedReference?: string
}

export interface ParsePassageRangeParams {
  input: string
  books: BibleBook[]
  /** Optional chapter info with verse counts for verse validation */
  chapters?: ChapterInfo[]
}

// Matches: "Gen 1:1", "Gen 1:1-5", "Gen 1:1-2:5", "1 Ioan 3:16"
// Groups: [full, bookName, startChapter, startVerse, endChapter?, endVerse?]
const PASSAGE_PATTERN =
  /^(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)\s*(\d+)\s*[:.,]\s*(\d+)(?:\s*[-–—]\s*(?:(\d+)\s*[:.,]\s*)?(\d+))?$/i

export function parsePassageRange(
  params: ParsePassageRangeParams,
): ParsedPassageRange {
  const { input, books, chapters } = params
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      status: 'empty',
      errorKey: 'biblePassage.errors.empty',
    }
  }

  const match = trimmed.match(PASSAGE_PATTERN)
  if (!match) {
    return {
      status: 'invalid_format',
      errorKey: 'biblePassage.errors.invalid_format',
    }
  }

  const [
    ,
    bookPart,
    startChapterStr,
    startVerseStr,
    endChapterStr,
    endVerseStr,
  ] = match
  const bookQuery = bookPart.trim()

  // Find matching book
  const matchedBook = findMatchingBook(bookQuery, books)
  if (!matchedBook) {
    return {
      status: 'book_not_found',
      errorKey: 'biblePassage.errors.book_not_found',
    }
  }

  const startChapter = parseInt(startChapterStr, 10)
  const startVerse = parseInt(startVerseStr, 10)

  // Determine end chapter and verse
  let endChapter: number
  let endVerse: number

  if (endVerseStr) {
    // Has end range
    if (endChapterStr) {
      // Cross-chapter range: Gen 1:1-2:5
      endChapter = parseInt(endChapterStr, 10)
      endVerse = parseInt(endVerseStr, 10)
    } else {
      // Same chapter range: Gen 1:1-5
      endChapter = startChapter
      endVerse = parseInt(endVerseStr, 10)
    }
  } else {
    // Single verse: Gen 1:1
    endChapter = startChapter
    endVerse = startVerse
  }

  // Validate chapter numbers
  if (startChapter < 1 || startChapter > matchedBook.chapterCount) {
    return {
      status: 'invalid_chapter',
      errorKey: 'biblePassage.errors.invalid_chapter',
    }
  }

  if (endChapter < 1 || endChapter > matchedBook.chapterCount) {
    return {
      status: 'invalid_chapter',
      errorKey: 'biblePassage.errors.invalid_chapter',
    }
  }

  // Validate end >= start (chronologically)
  if (
    endChapter < startChapter ||
    (endChapter === startChapter && endVerse < startVerse)
  ) {
    return {
      status: 'end_before_start',
      errorKey: 'biblePassage.errors.end_before_start',
    }
  }

  // Validate verse numbers if chapters data is provided
  if (chapters && chapters.length > 0) {
    const startChapterInfo = chapters.find((c) => c.chapter === startChapter)
    const endChapterInfo = chapters.find((c) => c.chapter === endChapter)

    // Check if start verse exists in the start chapter
    if (startChapterInfo && startVerse > startChapterInfo.verseCount) {
      return {
        status: 'invalid_verse',
        errorKey: 'biblePassage.errors.invalid_verse',
        matchedBook, // Include matchedBook so calling code can maintain book ID
      }
    }

    // Check if end verse exists in the end chapter
    if (endChapterInfo && endVerse > endChapterInfo.verseCount) {
      return {
        status: 'invalid_verse',
        errorKey: 'biblePassage.errors.invalid_verse',
        matchedBook, // Include matchedBook so calling code can maintain book ID
      }
    }
  }

  // Format the reference
  const formattedReference = formatReference(
    matchedBook.bookName,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
  )

  return {
    status: 'valid',
    bookCode: matchedBook.bookCode,
    bookName: matchedBook.bookName,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
    matchedBook,
    formattedReference,
  }
}

function formatReference(
  bookName: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
): string {
  if (startChapter === endChapter) {
    if (startVerse === endVerse) {
      return `${bookName} ${startChapter}:${startVerse}`
    }
    return `${bookName} ${startChapter}:${startVerse}-${endVerse}`
  }
  return `${bookName} ${startChapter}:${startVerse} - ${endChapter}:${endVerse}`
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
