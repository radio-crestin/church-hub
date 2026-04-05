import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AddToHistoryInput, BibleHistoryItem } from '../../types'
import { addToHistory, clearHistory, getHistory } from '../history'

// ---------------------------------------------------------------------------
// Mock fetcher
// ---------------------------------------------------------------------------

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleHistoryItem: BibleHistoryItem = {
  id: 1,
  verseId: 100,
  reference: 'Ioan 3:16',
  text: 'Fiindca atat de mult a iubit Dumnezeu lumea...',
  translationAbbreviation: 'VDC',
  bookName: 'Ioan',
  translationId: 1,
  bookId: 43,
  chapter: 3,
  verse: 16,
  createdAt: 1700000000,
}

const sampleInput: AddToHistoryInput = {
  verseId: 100,
  reference: 'Ioan 3:16',
  text: 'Fiindca atat de mult a iubit Dumnezeu lumea...',
  translationAbbreviation: 'VDC',
  bookName: 'Ioan',
  translationId: 1,
  bookId: 43,
  chapter: 3,
  verse: 16,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('history service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- getHistory ----
  describe('getHistory', () => {
    it('fetches and returns history items', async () => {
      mockFetcher.mockResolvedValueOnce({ data: [sampleHistoryItem] })
      const result = await getHistory()
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible-history')
      expect(result).toEqual([sampleHistoryItem])
    })

    it('returns empty array when data is null/undefined', async () => {
      mockFetcher.mockResolvedValueOnce({ data: null })
      const result = await getHistory()
      expect(result).toEqual([])
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValueOnce({})
      const result = await getHistory()
      expect(result).toEqual([])
    })

    it('propagates fetch errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Network error'))
      await expect(getHistory()).rejects.toThrow('Network error')
    })
  })

  // ---- addToHistory ----
  describe('addToHistory', () => {
    it('sends POST with correct body and returns history item', async () => {
      mockFetcher.mockResolvedValueOnce({ data: sampleHistoryItem })
      const result = await addToHistory(sampleInput)
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleInput),
      })
      expect(result).toEqual(sampleHistoryItem)
    })

    it('returns null when data is null/undefined', async () => {
      mockFetcher.mockResolvedValueOnce({ data: null })
      const result = await addToHistory(sampleInput)
      expect(result).toBeNull()
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValueOnce({})
      const result = await addToHistory(sampleInput)
      expect(result).toBeNull()
    })

    it('propagates fetch errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Server error'))
      await expect(addToHistory(sampleInput)).rejects.toThrow('Server error')
    })
  })

  // ---- clearHistory ----
  describe('clearHistory', () => {
    it('sends DELETE and returns true on success', async () => {
      mockFetcher.mockResolvedValueOnce({ success: true })
      const result = await clearHistory()
      expect(mockFetcher).toHaveBeenCalledWith('/api/bible-history', {
        method: 'DELETE',
      })
      expect(result).toBe(true)
    })

    it('returns false when success is false', async () => {
      mockFetcher.mockResolvedValueOnce({ success: false })
      const result = await clearHistory()
      expect(result).toBe(false)
    })

    it('returns false when success is undefined', async () => {
      mockFetcher.mockResolvedValueOnce({})
      const result = await clearHistory()
      expect(result).toBe(false)
    })

    it('returns false when response is null-ish', async () => {
      mockFetcher.mockResolvedValueOnce({ success: null })
      const result = await clearHistory()
      expect(result).toBe(false)
    })

    it('propagates fetch errors', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Network error'))
      await expect(clearHistory()).rejects.toThrow('Network error')
    })
  })
})
