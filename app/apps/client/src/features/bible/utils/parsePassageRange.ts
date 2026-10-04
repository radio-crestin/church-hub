import { formatVerseSegments } from './formatVerseSegments'
import { mergeVerseSegments } from './mergeVerseSegments'
import { parseVerseList, type VerseSegment } from './parseVerseList'
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
  /**
   * Set only for a verse list with a gap ("Ioan 3:16-18,20"): the runs to read,
   * sorted and merged. startVerse/endVerse then hold the outer bounds.
   */
  verseSegments?: VerseSegment[]
  matchedBook?: BibleBook
  formattedReference?: string
}

export interface ParsePassageRangeParams {
  input: string
  books: BibleBook[]
  /** Optional chapter info with verse counts for verse validation */
  chapters?: ChapterInfo[]
}

const BOOK = String.raw`(\d?\s*[a-zA-ZăâîșțĂÂÎȘȚ]+)\s*`
const SEPARATOR = String.raw`\s*([:.,])\s*`
const DASH = String.raw`\s*[-–—]\s*`

// Across chapters: "Gen 1:1-2:5", "Gen 1.1-2.5", "Gen 1,1-2,5".
// Groups: [full, book, startChapter, startSep, startVerse, endChapter, endSep, endVerse]
const CROSS_CHAPTER_PATTERN = new RegExp(
  String.raw`^${BOOK}(\d+)${SEPARATOR}(\d+)${DASH}(\d+)${SEPARATOR}(\d+)$`,
  'i',
)

// Inside one chapter: "Ioan 3:16", "Ioan 3:16-18", "Geneza 1,1", and comma
// verse lists "Ioan 3:16,17" / "Ioan 3:16-18,20".
// Groups: [full, book, chapter, separator, verseList]
const ONE_CHAPTER_PATTERN = new RegExp(
  String.raw`^${BOOK}(\d+)${SEPARATOR}(\d+(?:\s*[-–—,]\s*\d+)*)$`,
  'i',
)

interface ReferenceParts {
  bookQuery: string
  startChapter: number
  endChapter: number
  /** Runs of verses as typed; one run when the passage crosses chapters. */
  segments: VerseSegment[]
}

/**
 * Splits a reference into book, chapters and verse runs.
 *
 * A comma means two things. Right after the chapter it separates chapter and
 * verse ("Geneza 1,1"), and after a verse it starts the next verse of a list
 * ("Ioan 3:16,17"). So "Gen 1:1-2,5" is the list 1-2 and 5, while the
 * chapter-crossing reading needs the same separator on both ends:
 * "Gen 1:1-2:5" or "Gen 1,1-2,5".
 */
function splitReference(input: string): ReferenceParts | null {
  const cross = input.match(CROSS_CHAPTER_PATTERN)
  if (cross) {
    const [, book, startCh, startSep, startV, endCh, endSep, endV] = cross
    const listComma = startSep !== ',' && endSep === ','
    if (!listComma) {
      return {
        bookQuery: book.trim(),
        startChapter: parseInt(startCh, 10),
        endChapter: parseInt(endCh, 10),
        segments: [
          { startVerse: parseInt(startV, 10), endVerse: parseInt(endV, 10) },
        ],
      }
    }
  }

  const single = input.match(ONE_CHAPTER_PATTERN)
  if (!single) return null
  const [, book, chapter, , verseList] = single
  const segments = parseVerseList(verseList)
  if (!segments) return null
  const chapterNumber = parseInt(chapter, 10)
  return {
    bookQuery: book.trim(),
    startChapter: chapterNumber,
    endChapter: chapterNumber,
    segments,
  }
}

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

  const parts = splitReference(trimmed)
  if (!parts) {
    return {
      status: 'invalid_format',
      errorKey: 'biblePassage.errors.invalid_format',
    }
  }

  // Find matching book
  const matchedBook = findMatchingBook(parts.bookQuery, books)
  if (!matchedBook) {
    return {
      status: 'book_not_found',
      errorKey: 'biblePassage.errors.book_not_found',
    }
  }

  const { startChapter, endChapter } = parts
  const isSameChapter = startChapter === endChapter
  const runBackwards = parts.segments.some(
    (segment) => isSameChapter && segment.endVerse < segment.startVerse,
  )
  const segments = isSameChapter
    ? mergeVerseSegments(parts.segments)
    : parts.segments
  const startVerse = segments[0].startVerse
  const endVerse = segments[segments.length - 1].endVerse

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
    runBackwards ||
    endChapter < startChapter ||
    (isSameChapter && endVerse < startVerse)
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

  // A list with a gap keeps its runs; anything else is one plain range.
  const verseSegments = segments.length > 1 ? segments : undefined
  const formattedReference = verseSegments
    ? `${matchedBook.bookName} ${startChapter}:${formatVerseSegments(verseSegments)}`
    : formatReference(
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
    verseSegments,
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
