import { beforeEach, describe, expect, it, vi } from 'vitest'

import { rebuildSearchIndexes } from '../database'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('database-management/service/database', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rebuildSearchIndexes', () => {
    it('rebuilds all indexes without options', async () => {
      mockFetcher.mockResolvedValue({
        data: { success: true, duration: 500, indexes: ['songs', 'schedules'] },
      })
      const result = await rebuildSearchIndexes()
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/database/rebuild-search-indexes',
        {
          method: 'POST',
          body: undefined,
        },
      )
      expect(result).toEqual({
        success: true,
        duration: 500,
        indexes: ['songs', 'schedules'],
      })
    })

    it('rebuilds specific indexes with options', async () => {
      mockFetcher.mockResolvedValue({
        data: { success: true, duration: 100, indexes: ['songs'] },
      })
      const result = await rebuildSearchIndexes({ songs: true })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/database/rebuild-search-indexes',
        {
          method: 'POST',
          body: JSON.stringify({ songs: true }),
        },
      )
      expect(result.success).toBe(true)
    })

    it('returns error when response has error', async () => {
      mockFetcher.mockResolvedValue({ error: 'Database locked' })
      const result = await rebuildSearchIndexes()
      expect(result).toEqual({ success: false, error: 'Database locked' })
    })

    it('returns success false when data has success false', async () => {
      mockFetcher.mockResolvedValue({ data: { success: false } })
      const result = await rebuildSearchIndexes()
      expect(result.success).toBe(false)
    })

    it('handles undefined data', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await rebuildSearchIndexes()
      expect(result.success).toBe(false)
    })
  })
})
