import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSongsForExport } from '../exportSongs'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('song-export/service/exportSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchSongsForExport', () => {
    it('fetches all songs when categoryId is null', async () => {
      const songs = [{ id: 1, title: 'Song 1' }]
      mockFetcher.mockResolvedValue({ data: songs })
      const result = await fetchSongsForExport(null)
      expect(mockFetcher).toHaveBeenCalledWith('/api/songs/export')
      expect(result).toEqual(songs)
    })

    it('fetches songs filtered by categoryId', async () => {
      const songs = [{ id: 2, title: 'Song 2' }]
      mockFetcher.mockResolvedValue({ data: songs })
      const result = await fetchSongsForExport(5)
      expect(mockFetcher).toHaveBeenCalledWith('/api/songs/export?categoryId=5')
      expect(result).toEqual(songs)
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await fetchSongsForExport(null)
      expect(result).toEqual([])
    })
  })
})
