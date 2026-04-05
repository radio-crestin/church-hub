import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getFileById, getFiles } from '../files'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('music/service/files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFiles', () => {
    it('fetches files without params', async () => {
      mockFetcher.mockResolvedValue({ data: [{ id: 1 }] })
      const result = await getFiles()
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/files')
      expect(result).toEqual([{ id: 1 }])
    })

    it('appends folderId as query param', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ folderId: 5 })
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/files?folderId=5')
    })

    it('appends search as query param', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ search: 'hello' })
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/files?search=hello')
    })

    it('appends artist as query param', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ artist: 'Bach' })
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/files?artist=Bach')
    })

    it('appends album as query param', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ album: 'Greatest Hits' })
      expect(mockFetcher).toHaveBeenCalledWith(
        expect.stringContaining('album=Greatest+Hits'),
      )
    })

    it('appends limit and offset as query params', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ limit: 10, offset: 20 })
      const url = mockFetcher.mock.calls[0][0] as string
      expect(url).toContain('limit=10')
      expect(url).toContain('offset=20')
    })

    it('appends multiple query params', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ folderId: 1, search: 'test', limit: 5 })
      const url = mockFetcher.mock.calls[0][0] as string
      expect(url).toContain('folderId=1')
      expect(url).toContain('search=test')
      expect(url).toContain('limit=5')
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getFiles()
      expect(result).toEqual([])
    })

    it('does not include falsy params in query string', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getFiles({ folderId: 0, search: '', limit: 0 })
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/files')
    })
  })

  describe('getFileById', () => {
    it('fetches a file by ID', async () => {
      const file = { id: 42, filename: 'song.mp3' }
      mockFetcher.mockResolvedValue({ data: file })
      const result = await getFileById(42)
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/files/42')
      expect(result).toEqual(file)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getFileById(999)
      expect(result).toBeNull()
    })
  })
})
