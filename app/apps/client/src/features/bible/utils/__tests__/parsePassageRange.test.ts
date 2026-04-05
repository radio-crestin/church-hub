import { describe, expect, it } from 'vitest'

import type { BibleBook } from '../../types'
import {
  type ChapterInfo,
  type ParsePassageRangeParams,
  parsePassageRange,
} from '../parsePassageRange'

// ---------------------------------------------------------------------------
// Helpers & fixtures
// ---------------------------------------------------------------------------

const makeBook = (
  overrides: Partial<BibleBook> & Pick<BibleBook, 'bookCode' | 'bookName'>,
): BibleBook => ({
  id: 1,
  translationId: 1,
  bookOrder: 1,
  chapterCount: 50,
  ...overrides,
})

const books: BibleBook[] = [
  makeBook({
    id: 1,
    bookCode: 'gen',
    bookName: 'Geneza',
    bookOrder: 1,
    chapterCount: 50,
  }),
  makeBook({
    id: 2,
    bookCode: 'exod',
    bookName: 'Exodul',
    bookOrder: 2,
    chapterCount: 40,
  }),
  makeBook({
    id: 43,
    bookCode: 'ioan',
    bookName: 'Ioan',
    bookOrder: 43,
    chapterCount: 21,
  }),
  makeBook({
    id: 44,
    bookCode: '1ioan',
    bookName: '1 Ioan',
    bookOrder: 44,
    chapterCount: 5,
  }),
  makeBook({
    id: 19,
    bookCode: 'ps',
    bookName: 'Psalmi',
    bookOrder: 19,
    chapterCount: 150,
  }),
  makeBook({
    id: 45,
    bookCode: 'rom',
    bookName: 'Romani',
    bookOrder: 45,
    chapterCount: 16,
  }),
]

const chaptersGen: ChapterInfo[] = [
  { chapter: 1, verseCount: 31 },
  { chapter: 2, verseCount: 25 },
  { chapter: 3, verseCount: 24 },
]

const _chaptersIoan: ChapterInfo[] = [
  { chapter: 3, verseCount: 36 },
  { chapter: 4, verseCount: 54 },
]

function parse(
  input: string,
  chapters?: ChapterInfo[],
): ReturnType<typeof parsePassageRange> {
  const params: ParsePassageRangeParams = { input, books, chapters }
  return parsePassageRange(params)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parsePassageRange', () => {
  // ---- Empty / whitespace ----
  describe('empty input', () => {
    it('returns "empty" for empty string', () => {
      const result = parse('')
      expect(result.status).toBe('empty')
      expect(result.errorKey).toBe('biblePassage.errors.empty')
    })

    it('returns "empty" for whitespace-only', () => {
      expect(parse('   ').status).toBe('empty')
      expect(parse('\t').status).toBe('empty')
    })
  })

  // ---- Invalid format ----
  describe('invalid format', () => {
    it('returns "invalid_format" when no chapter:verse provided', () => {
      expect(parse('Ioan').status).toBe('invalid_format')
    })

    it('returns "invalid_format" for just a number', () => {
      expect(parse('123').status).toBe('invalid_format')
    })

    it('returns "invalid_format" for chapter-only reference', () => {
      expect(parse('Ioan 3').status).toBe('invalid_format')
    })

    it('returns "invalid_format" for random text', () => {
      expect(parse('hello world').status).toBe('invalid_format')
    })

    it('returns "invalid_format" for special characters', () => {
      expect(parse('!@#$%').status).toBe('invalid_format')
    })
  })

  // ---- Book not found ----
  describe('book not found', () => {
    it('returns "book_not_found" for unknown book name', () => {
      const result = parse('XyzBook 1:1')
      expect(result.status).toBe('book_not_found')
      expect(result.errorKey).toBe('biblePassage.errors.book_not_found')
    })
  })

  // ---- Single verse ----
  describe('single verse', () => {
    it('parses "Ioan 3:16"', () => {
      const result = parse('Ioan 3:16')
      expect(result.status).toBe('valid')
      expect(result.bookCode).toBe('ioan')
      expect(result.bookName).toBe('Ioan')
      expect(result.startChapter).toBe(3)
      expect(result.startVerse).toBe(16)
      expect(result.endChapter).toBe(3)
      expect(result.endVerse).toBe(16)
      expect(result.formattedReference).toBe('Ioan 3:16')
    })

    it('parses with dot separator "Geneza 1.1"', () => {
      const result = parse('Geneza 1.1')
      expect(result.status).toBe('valid')
      expect(result.startChapter).toBe(1)
      expect(result.startVerse).toBe(1)
    })

    it('parses with comma separator "Geneza 1,1"', () => {
      const result = parse('Geneza 1,1')
      expect(result.status).toBe('valid')
      expect(result.startChapter).toBe(1)
      expect(result.startVerse).toBe(1)
    })
  })

  // ---- Same-chapter range ----
  describe('same-chapter range', () => {
    it('parses "Geneza 1:1-5"', () => {
      const result = parse('Geneza 1:1-5')
      expect(result.status).toBe('valid')
      expect(result.startChapter).toBe(1)
      expect(result.startVerse).toBe(1)
      expect(result.endChapter).toBe(1)
      expect(result.endVerse).toBe(5)
      expect(result.formattedReference).toBe('Geneza 1:1-5')
    })

    it('parses with en-dash separator "Ioan 3:16\u201318"', () => {
      const result = parse('Ioan 3:16\u201318')
      expect(result.status).toBe('valid')
      expect(result.startVerse).toBe(16)
      expect(result.endVerse).toBe(18)
    })

    it('parses with em-dash separator "Ioan 3:16\u201418"', () => {
      const result = parse('Ioan 3:16\u201418')
      expect(result.status).toBe('valid')
      expect(result.endVerse).toBe(18)
    })
  })

  // ---- Cross-chapter range ----
  describe('cross-chapter range', () => {
    it('parses "Geneza 1:1-2:5"', () => {
      const result = parse('Geneza 1:1-2:5')
      expect(result.status).toBe('valid')
      expect(result.startChapter).toBe(1)
      expect(result.startVerse).toBe(1)
      expect(result.endChapter).toBe(2)
      expect(result.endVerse).toBe(5)
      expect(result.formattedReference).toBe('Geneza 1:1 - 2:5')
    })

    it('parses cross-chapter with dot separators "Geneza 1.1-2.5"', () => {
      const result = parse('Geneza 1.1-2.5')
      expect(result.status).toBe('valid')
      expect(result.endChapter).toBe(2)
      expect(result.endVerse).toBe(5)
    })
  })

  // ---- Book matching strategies ----
  describe('book matching', () => {
    it('matches by exact name', () => {
      const result = parse('Ioan 3:16')
      expect(result.matchedBook?.bookName).toBe('Ioan')
    })

    it('matches by prefix ("Gen 1:1" -> Geneza)', () => {
      const result = parse('Gen 1:1')
      expect(result.status).toBe('valid')
      expect(result.bookName).toBe('Geneza')
    })

    it('matches by book code ("ps 1:1" -> Psalmi)', () => {
      const result = parse('ps 1:1')
      expect(result.status).toBe('valid')
      expect(result.bookName).toBe('Psalmi')
    })

    it('matches numbered book ("1 Ioan 3:1")', () => {
      const result = parse('1 Ioan 3:1')
      expect(result.status).toBe('valid')
      expect(result.bookCode).toBe('1ioan')
    })

    it('is case-insensitive ("IOAN 3:16")', () => {
      const result = parse('IOAN 3:16')
      expect(result.status).toBe('valid')
      expect(result.bookName).toBe('Ioan')
    })
  })

  // ---- Diacritics handling ----
  describe('diacritics', () => {
    it('normalizes diacritics so "Ioan" matches regardless of accents', () => {
      // "Io\u00e2n" with a-circumflex - should still match Ioan via normalization
      const result = parse('Io\u00e2n 3:16')
      expect(result.status).toBe('valid')
      expect(result.bookName).toBe('Ioan')
    })
  })

  // ---- Invalid chapter ----
  describe('invalid chapter', () => {
    it('rejects start chapter 0', () => {
      const result = parse('Ioan 0:1')
      expect(result.status).toBe('invalid_chapter')
    })

    it('rejects start chapter beyond book limit', () => {
      const result = parse('Ioan 99:1') // Ioan has 21 chapters
      expect(result.status).toBe('invalid_chapter')
    })

    it('rejects end chapter beyond book limit in cross-chapter range', () => {
      const result = parse('Ioan 1:1-99:1')
      expect(result.status).toBe('invalid_chapter')
    })

    it('rejects end chapter 0 in cross-chapter range', () => {
      // "Ioan 1:5-0:1" -> endChapter=0
      const result = parse('Ioan 1:5-0:1')
      expect(result.status).toBe('invalid_chapter')
    })
  })

  // ---- End before start ----
  describe('end before start', () => {
    it('rejects when end chapter is before start chapter', () => {
      const result = parse('Geneza 3:1-1:5')
      expect(result.status).toBe('end_before_start')
      expect(result.errorKey).toBe('biblePassage.errors.end_before_start')
    })

    it('rejects when end verse is before start verse in same chapter', () => {
      const result = parse('Geneza 1:10-5')
      expect(result.status).toBe('end_before_start')
    })
  })

  // ---- Verse validation with chapters info ----
  describe('verse validation (with chapters data)', () => {
    it('passes when verse is within range', () => {
      const result = parse('Geneza 1:31', chaptersGen)
      expect(result.status).toBe('valid')
    })

    it('rejects start verse exceeding chapter verse count', () => {
      const result = parse('Geneza 1:99', chaptersGen) // ch1 has 31 verses
      expect(result.status).toBe('invalid_verse')
      expect(result.errorKey).toBe('biblePassage.errors.invalid_verse')
      expect(result.matchedBook).toBeDefined()
    })

    it('rejects end verse exceeding chapter verse count in range', () => {
      const result = parse('Geneza 1:1-99', chaptersGen) // ch1 has 31 verses
      expect(result.status).toBe('invalid_verse')
    })

    it('validates cross-chapter end verse against end chapter info', () => {
      const result = parse('Geneza 1:1-2:99', chaptersGen) // ch2 has 25 verses
      expect(result.status).toBe('invalid_verse')
    })

    it('skips verse validation when chapter info not found for that chapter', () => {
      // chaptersGen only has chapters 1-3, querying chapter 10 skips validation
      const result = parse('Geneza 10:999', chaptersGen)
      expect(result.status).toBe('valid')
    })

    it('skips verse validation when chapters array is empty', () => {
      const result = parse('Geneza 1:999', [])
      expect(result.status).toBe('valid')
    })

    it('skips verse validation when chapters is undefined', () => {
      const result = parse('Geneza 1:999')
      expect(result.status).toBe('valid')
    })
  })

  // ---- Formatted reference output ----
  describe('formattedReference', () => {
    it('single verse: "BookName ch:v"', () => {
      expect(parse('Ioan 3:16').formattedReference).toBe('Ioan 3:16')
    })

    it('same-chapter range: "BookName ch:v1-v2"', () => {
      expect(parse('Ioan 3:16-18').formattedReference).toBe('Ioan 3:16-18')
    })

    it('cross-chapter range: "BookName ch1:v1 - ch2:v2"', () => {
      expect(parse('Geneza 1:1-2:5').formattedReference).toBe(
        'Geneza 1:1 - 2:5',
      )
    })
  })

  // ---- Whitespace tolerance ----
  describe('whitespace handling', () => {
    it('trims leading/trailing whitespace', () => {
      const result = parse('  Ioan 3:16  ')
      expect(result.status).toBe('valid')
    })

    it('handles spaces around dash in range', () => {
      const result = parse('Ioan 3:16 - 18')
      expect(result.status).toBe('valid')
      expect(result.endVerse).toBe(18)
    })

    it('handles spaces around dash in cross-chapter range', () => {
      const result = parse('Geneza 1:1 - 2:5')
      expect(result.status).toBe('valid')
      expect(result.endChapter).toBe(2)
    })
  })
})
