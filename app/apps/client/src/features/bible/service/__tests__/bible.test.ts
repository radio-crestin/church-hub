import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AIBibleSearchResponse,
  BibleBook,
  BibleChapter,
  BibleTranslation,
  BibleVerse,
  SearchBibleResponse,
} from '../../types'
import {
  aiBibleSearch,
  deleteTranslation,
  getBooks,
  getChapters,
  getNextVerse,
  getTranslationById,
  getTranslations,
  getVerseById,
  getVerseByReference,
  getVerses,
  importTranslation,
  searchBible,
} from '../bible'

// ---------------------------------------------------------------------------
// Mock fetcher
// ---------------------------------------------------------------------------

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

// We import *after* vi.mock so we get the mocked version
import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleTranslation: BibleTranslation = {
  id: 1,
  name: 'Cornilescu',
  abbreviation: 'VDC',
  language: 'ro',
  sourceFilename: 'vdc.xml',
  bookCount: 66,
  verseCount: 31102,
  createdAt: 1000,
  updatedAt: 2000,
}

const sampleBook: BibleBook = {
  id: 43,
  translationId: 1,
  bookCode: 'ioan',
  bookName: 'Ioan',
  bookOrder: 43,
  chapterCount: 21,
}

const sampleVerse: BibleVerse = {
  id: 100,
  translationId: 1,
  bookId: 43,
  bookCode: 'ioan',
  bookName: 'Ioan',
  chapter: 3,
  verse: 16,
  text: 'Fiindca atat de mult a iubit Dumnezeu lumea...',
}

const sampleChapter: BibleChapter = {
  chapter: 3,
  verseCount: 36,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bible service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- getTranslations ----
  describe('getTranslations', () => {
    it('fetches and returns translations array', async () => {
      mockFetcher.mockResolvedValueOnce({ data: [sampleTranslation] })
      const result = await getTranslations()
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/translations')
      expect(result).toEqual([sampleTranslation])
    })

    it('returns empty array when server returns empty', async () => {
      mockFetcher.mockResolvedValueOnce({ data: [] })
      const result = await getTranslations()
      expect(result).toEqual([])
    })

    it('propagates fetch errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Network error'))
      await expect(getTranslations()).rejects.toThrow('Network error')
    })
  })

  // ---- getTranslationById ----
  describe('getTranslationById', () => {
    it('fetches a single translation by id', async () => {
      mockFetcher.mockResolvedValueOnce({ data: sampleTranslation })
      const result = await getTranslationById(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/translations/1')
      expect(result).toEqual(sampleTranslation)
    })

    it('propagates errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Not found'))
      await expect(getTranslationById(999)).rejects.toThrow('Not found')
    })
  })

  // ---- importTranslation ----
  describe('importTranslation', () => {
    it('sends POST with translation input and returns result', async () => {
      const input = {
        name: 'Test',
        abbreviation: 'TST',
        language: 'en',
        xmlContent: '<xml/>',
      }
      mockFetcher.mockResolvedValueOnce({
        data: { ...sampleTranslation, ...input },
      })

      const result = await importTranslation(input)

      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/translations', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      expect(result.name).toBe('Test')
    })

    it('propagates errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Import failed'))
      await expect(
        importTranslation({
          name: '',
          abbreviation: '',
          language: '',
          xmlContent: '',
        }),
      ).rejects.toThrow('Import failed')
    })
  })

  // ---- deleteTranslation ----
  describe('deleteTranslation', () => {
    it('sends DELETE request', async () => {
      mockFetcher.mockResolvedValueOnce(undefined)
      await deleteTranslation(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/translations/1', {
        method: 'DELETE',
      })
    })

    it('propagates errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Forbidden'))
      await expect(deleteTranslation(1)).rejects.toThrow('Forbidden')
    })
  })

  // ---- getBooks ----
  describe('getBooks', () => {
    it('fetches books for a translation', async () => {
      mockFetcher.mockResolvedValueOnce({ data: [sampleBook] })
      const result = await getBooks(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/books/1')
      expect(result).toEqual([sampleBook])
    })
  })

  // ---- getChapters ----
  describe('getChapters', () => {
    it('fetches chapters for a book', async () => {
      mockFetcher.mockResolvedValueOnce({ data: [sampleChapter] })
      const result = await getChapters(43)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/chapters/43')
      expect(result).toEqual([sampleChapter])
    })
  })

  // ---- getVerses ----
  describe('getVerses', () => {
    it('fetches verses for a book and chapter', async () => {
      mockFetcher.mockResolvedValueOnce({ data: [sampleVerse] })
      const result = await getVerses(43, 3)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/verses/43/3')
      expect(result).toEqual([sampleVerse])
    })
  })

  // ---- getVerseById ----
  describe('getVerseById', () => {
    it('fetches a single verse by id', async () => {
      mockFetcher.mockResolvedValueOnce({ data: sampleVerse })
      const result = await getVerseById(100)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/verse/100')
      expect(result).toEqual(sampleVerse)
    })
  })

  // ---- getNextVerse ----
  describe('getNextVerse', () => {
    it('fetches the next verse in sequence', async () => {
      const nextVerse = { ...sampleVerse, id: 101, verse: 17 }
      mockFetcher.mockResolvedValueOnce({ data: nextVerse })
      const result = await getNextVerse(100)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/next-verse/100')
      expect(result).toEqual(nextVerse)
    })

    it('returns null when server returns null data', async () => {
      mockFetcher.mockResolvedValueOnce({ data: null })
      const result = await getNextVerse(100)
      expect(result).toBeNull()
    })

    it('returns null on fetch error (catches internally)', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Not found'))
      const result = await getNextVerse(999)
      expect(result).toBeNull()
    })
  })

  // ---- getVerseByReference ----
  describe('getVerseByReference', () => {
    it('fetches verse by translation/book/chapter/verse reference', async () => {
      mockFetcher.mockResolvedValueOnce({ data: sampleVerse })
      const result = await getVerseByReference(1, 'ioan', 3, 16)
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/bible/verse-by-reference/1/ioan/3/16',
      )
      expect(result).toEqual(sampleVerse)
    })

    it('returns null when server returns null', async () => {
      mockFetcher.mockResolvedValueOnce({ data: null })
      const result = await getVerseByReference(1, 'ioan', 3, 16)
      expect(result).toBeNull()
    })

    it('returns null on fetch error (catches internally)', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Timeout'))
      const result = await getVerseByReference(1, 'ioan', 3, 16)
      expect(result).toBeNull()
    })
  })

  // ---- searchBible ----
  describe('searchBible', () => {
    const searchResponse: SearchBibleResponse = {
      type: 'text',
      results: [sampleVerse],
    }

    it('searches with query only', async () => {
      mockFetcher.mockResolvedValueOnce({ data: searchResponse })
      const result = await searchBible('love')
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/search?q=love', {
        signal: undefined,
      })
      expect(result).toEqual(searchResponse)
    })

    it('includes translationId param when provided', async () => {
      mockFetcher.mockResolvedValueOnce({ data: searchResponse })
      await searchBible('love', 1)
      const url = mockFetcher.mock.calls[0][0] as string
      expect(url).toContain('translationId=1')
    })

    it('includes limit param when provided', async () => {
      mockFetcher.mockResolvedValueOnce({ data: searchResponse })
      await searchBible('love', undefined, 10)
      const url = mockFetcher.mock.calls[0][0] as string
      expect(url).toContain('limit=10')
    })

    it('includes both translationId and limit', async () => {
      mockFetcher.mockResolvedValueOnce({ data: searchResponse })
      await searchBible('love', 1, 10)
      const url = mockFetcher.mock.calls[0][0] as string
      expect(url).toContain('translationId=1')
      expect(url).toContain('limit=10')
    })

    it('passes AbortSignal to fetcher', async () => {
      const controller = new AbortController()
      mockFetcher.mockResolvedValueOnce({ data: searchResponse })
      await searchBible('love', undefined, undefined, controller.signal)
      expect(mockFetcher).toHaveBeenCalledWith(expect.any(String), {
        signal: controller.signal,
      })
    })

    it('propagates errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Search failed'))
      await expect(searchBible('love')).rejects.toThrow('Search failed')
    })
  })

  // ---- aiBibleSearch ----
  describe('aiBibleSearch', () => {
    const aiResponse: AIBibleSearchResponse = {
      results: [],
      termsUsed: ['love', 'iubire'],
      totalCandidates: 50,
      processingTimeMs: 120,
    }

    it('sends POST with query and returns AI search response', async () => {
      mockFetcher.mockResolvedValueOnce({ data: aiResponse })
      const result = await aiBibleSearch('love')
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/ai-search', {
        method: 'POST',
        body: JSON.stringify({ query: 'love', translationId: undefined }),
      })
      expect(result).toEqual(aiResponse)
    })

    it('includes translationId when provided', async () => {
      mockFetcher.mockResolvedValueOnce({ data: aiResponse })
      await aiBibleSearch('love', 1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible/ai-search', {
        method: 'POST',
        body: JSON.stringify({ query: 'love', translationId: 1 }),
      })
    })

    it('propagates errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('AI error'))
      await expect(aiBibleSearch('love')).rejects.toThrow('AI error')
    })
  })
})
