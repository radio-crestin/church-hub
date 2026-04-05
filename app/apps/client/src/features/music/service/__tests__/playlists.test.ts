import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addToPlaylist,
  deletePlaylist,
  getPlaylistById,
  getPlaylists,
  removeFromPlaylist,
  reorderPlaylistItems,
  upsertPlaylist,
} from '../playlists'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('music/service/playlists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPlaylists', () => {
    it('fetches all playlists', async () => {
      const playlists = [{ id: 1, name: 'Favorites' }]
      mockFetcher.mockResolvedValue({ data: playlists })
      const result = await getPlaylists()
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/playlists')
      expect(result).toEqual(playlists)
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getPlaylists()
      expect(result).toEqual([])
    })
  })

  describe('getPlaylistById', () => {
    it('fetches a playlist by ID with items', async () => {
      const playlist = { id: 1, name: 'Favorites', items: [] }
      mockFetcher.mockResolvedValue({ data: playlist })
      const result = await getPlaylistById(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/playlists/1')
      expect(result).toEqual(playlist)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getPlaylistById(999)
      expect(result).toBeNull()
    })
  })

  describe('upsertPlaylist', () => {
    it('creates a new playlist', async () => {
      const playlist = { id: 1, name: 'New Playlist' }
      mockFetcher.mockResolvedValue({ data: playlist })
      const result = await upsertPlaylist({ name: 'New Playlist' })
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Playlist' }),
      })
      expect(result).toEqual(playlist)
    })

    it('updates an existing playlist', async () => {
      const playlist = { id: 5, name: 'Updated', description: 'Desc' }
      mockFetcher.mockResolvedValue({ data: playlist })
      const result = await upsertPlaylist({
        id: 5,
        name: 'Updated',
        description: 'Desc',
      })
      expect(result).toEqual(playlist)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await upsertPlaylist({ name: 'Test' })
      expect(result).toBeNull()
    })
  })

  describe('deletePlaylist', () => {
    it('deletes a playlist and returns true', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await deletePlaylist(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/playlists/1', {
        method: 'DELETE',
      })
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await deletePlaylist(1)
      expect(result).toBe(false)
    })
  })

  describe('addToPlaylist', () => {
    it('adds a file to a playlist', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await addToPlaylist(1, 42)
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/playlists/1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: 42 }),
      })
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await addToPlaylist(1, 42)
      expect(result).toBe(false)
    })
  })

  describe('removeFromPlaylist', () => {
    it('removes an item from a playlist', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await removeFromPlaylist(1, 10)
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/music/playlists/1/items/10',
        { method: 'DELETE' },
      )
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await removeFromPlaylist(1, 10)
      expect(result).toBe(false)
    })
  })

  describe('reorderPlaylistItems', () => {
    it('reorders items in a playlist', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await reorderPlaylistItems(1, [3, 1, 2])
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/music/playlists/1/items/reorder',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: [3, 1, 2] }),
        },
      )
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await reorderPlaylistItems(1, [1])
      expect(result).toBe(false)
    })
  })
})
