import { describe, expect, it } from 'vitest'

import type { BibleBook } from '../../types'
import { parseReference } from '../parseReference'

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

function ref(query: string) {
  return parseReference(query, books)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseReference', () => {
  // ---- Empty / no match ----
  describe('empty and non-matching input', () => {
    it('returns type "none" for empty string', () => {
      expect(ref('').type).toBe('none')
    })

    it('returns type "none" for whitespace-only', () => {
      expect(ref('   ').type).toBe('none')
      expect(ref('\t\n').type).toBe('none')
    })

    it('returns type "none" for unrecognized book', () => {
      expect(ref('Zxybook 3 16').type).toBe('none')
    })

    it('returns type "none" for purely numeric input', () => {
      expect(ref('123').type).toBe('none')
    })

    it('returns type "none" for special characters', () => {
      expect(ref('!@#$%').type).toBe('none')
    })
  })

  // ---- Book-only references ----
  describe('book-only references', () => {
    it('parses "Ioan" as book type', () => {
      const result = ref('Ioan')
      expect(result.type).toBe('book')
      expect(result.bookName).toBe('Ioan')
      expect(result.chapter).toBeUndefined()
      expect(result.verse).toBeUndefined()
      expect(result.matchedBook).toBeDefined()
    })

    it('parses "Geneza" as book type', () => {
      const result = ref('Geneza')
      expect(result.type).toBe('book')
      expect(result.bookName).toBe('Geneza')
    })
  })

  // ---- Chapter references ----
  describe('chapter references', () => {
    it('parses "Ioan 3" as chapter type', () => {
      const result = ref('Ioan 3')
      expect(result.type).toBe('chapter')
      expect(result.bookName).toBe('Ioan')
      expect(result.chapter).toBe(3)
      expect(result.verse).toBeUndefined()
    })

    it('parses "Geneza 50" (last chapter)', () => {
      const result = ref('Geneza 50')
      expect(result.type).toBe('chapter')
      expect(result.chapter).toBe(50)
    })

    it('returns "none" when chapter exceeds book chapter count', () => {
      // Ioan has 21 chapters
      expect(ref('Ioan 99').type).toBe('none')
    })
  })

  // ---- Verse references ----
  describe('verse references', () => {
    it('parses "Ioan 3 16" (space-separated)', () => {
      const result = ref('Ioan 3 16')
      expect(result.type).toBe('verse')
      expect(result.bookName).toBe('Ioan')
      expect(result.chapter).toBe(3)
      expect(result.verse).toBe(16)
    })

    it('parses "Ioan 3:16" (colon separator)', () => {
      const result = ref('Ioan 3:16')
      expect(result.type).toBe('verse')
      expect(result.chapter).toBe(3)
      expect(result.verse).toBe(16)
    })

    it('parses "Ioan 3,16" (comma separator)', () => {
      const result = ref('Ioan 3,16')
      expect(result.type).toBe('verse')
      expect(result.chapter).toBe(3)
      expect(result.verse).toBe(16)
    })

    it('returns "none" when chapter exceeds limit even with verse', () => {
      expect(ref('Ioan 99 1').type).toBe('none')
    })
  })

  // ---- Numbered books ----
  describe('numbered books', () => {
    it('parses "1 Ioan" as book type', () => {
      const result = ref('1 Ioan')
      expect(result.type).toBe('book')
      expect(result.bookName).toBe('1 Ioan')
    })

    it('parses "1 Ioan 3" as chapter type', () => {
      const result = ref('1 Ioan 3')
      expect(result.type).toBe('chapter')
      expect(result.bookName).toBe('1 Ioan')
      expect(result.chapter).toBe(3)
    })

    it('parses "1 Ioan 3:1" as verse type', () => {
      const result = ref('1 Ioan 3:1')
      expect(result.type).toBe('verse')
      expect(result.bookName).toBe('1 Ioan')
      expect(result.chapter).toBe(3)
      expect(result.verse).toBe(1)
    })

    it('returns "none" when numbered book chapter exceeds limit', () => {
      // 1 Ioan has 5 chapters
      expect(ref('1 Ioan 10').type).toBe('none')
    })
  })

  // ---- Fuzzy / prefix matching ----
  describe('fuzzy / prefix matching', () => {
    it('matches by prefix ("Gen" -> "Geneza")', () => {
      const result = ref('Gen')
      expect(result.type).toBe('book')
      expect(result.bookName).toBe('Geneza')
    })

    it('matches by prefix with chapter ("Gen 1")', () => {
      const result = ref('Gen 1')
      expect(result.type).toBe('chapter')
      expect(result.bookName).toBe('Geneza')
    })

    it('matches by book code ("ps" -> "Psalmi")', () => {
      const result = ref('ps')
      expect(result.type).toBe('book')
      expect(result.bookName).toBe('Psalmi')
    })

    it('matches by book code with chapter ("rom 1")', () => {
      const result = ref('rom 1')
      expect(result.type).toBe('chapter')
      expect(result.bookName).toBe('Romani')
    })
  })

  // ---- Case insensitivity ----
  describe('case insensitivity', () => {
    it('handles uppercase "IOAN 3:16"', () => {
      const result = ref('IOAN 3:16')
      expect(result.type).toBe('verse')
      expect(result.bookName).toBe('Ioan')
    })

    it('handles mixed case "iOaN 3"', () => {
      const result = ref('iOaN 3')
      expect(result.type).toBe('chapter')
      expect(result.bookName).toBe('Ioan')
    })
  })

  // ---- Diacritics ----
  describe('diacritics handling', () => {
    it('normalizes diacritics for matching', () => {
      // "Io\u00e2n" with a-circumflex
      const result = ref('Io\u00e2n 3')
      expect(result.type).toBe('chapter')
      expect(result.bookName).toBe('Ioan')
    })
  })

  // ---- Whitespace normalization ----
  describe('whitespace normalization', () => {
    it('trims leading and trailing whitespace', () => {
      const result = ref('  Ioan 3:16  ')
      expect(result.type).toBe('verse')
    })

    it('collapses multiple spaces', () => {
      const result = ref('Ioan   3   16')
      expect(result.type).toBe('verse')
      expect(result.chapter).toBe(3)
      expect(result.verse).toBe(16)
    })
  })

  // ---- matchedBook presence ----
  describe('matchedBook in result', () => {
    it('includes matchedBook for book type', () => {
      expect(ref('Ioan').matchedBook?.bookCode).toBe('ioan')
    })

    it('includes matchedBook for chapter type', () => {
      expect(ref('Ioan 3').matchedBook?.id).toBe(43)
    })

    it('includes matchedBook for verse type', () => {
      expect(ref('Ioan 3:16').matchedBook?.chapterCount).toBe(21)
    })

    it('does not include matchedBook for none type', () => {
      expect(ref('').matchedBook).toBeUndefined()
    })
  })
})
