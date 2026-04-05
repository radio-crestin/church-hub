import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addFolder,
  getFolders,
  removeFolder,
  renameFolder,
  syncFolder,
} from '../folders'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('music/service/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getFolders', () => {
    it('fetches all folders', async () => {
      const folders = [{ id: 1, name: 'Worship', path: '/music/worship' }]
      mockFetcher.mockResolvedValue({ data: folders })
      const result = await getFolders()
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/folders')
      expect(result).toEqual(folders)
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getFolders()
      expect(result).toEqual([])
    })
  })

  describe('addFolder', () => {
    it('creates a folder with path only', async () => {
      const folder = { id: 1, path: '/music', name: 'music' }
      mockFetcher.mockResolvedValue({ data: folder })
      const result = await addFolder('/music')
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/music' }),
      })
      expect(result).toEqual(folder)
    })

    it('creates a folder with path and name', async () => {
      const folder = { id: 2, path: '/worship', name: 'Worship' }
      mockFetcher.mockResolvedValue({ data: folder })
      const result = await addFolder('/worship', 'Worship')
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/worship', name: 'Worship' }),
      })
      expect(result).toEqual(folder)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await addFolder('/path')
      expect(result).toBeNull()
    })
  })

  describe('removeFolder', () => {
    it('removes a folder and returns true on success', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await removeFolder(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/folders/1', {
        method: 'DELETE',
      })
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await removeFolder(1)
      expect(result).toBe(false)
    })

    it('returns false when success is false', async () => {
      mockFetcher.mockResolvedValue({ data: { success: false } })
      const result = await removeFolder(1)
      expect(result).toBe(false)
    })
  })

  describe('syncFolder', () => {
    it('syncs a folder and returns result', async () => {
      const syncResult = {
        success: true,
        filesAdded: 5,
        filesRemoved: 1,
        filesUpdated: 2,
        errors: [],
      }
      mockFetcher.mockResolvedValue({ data: syncResult })
      const result = await syncFolder(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/folders/1/sync', {
        method: 'POST',
      })
      expect(result).toEqual(syncResult)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await syncFolder(1)
      expect(result).toBeNull()
    })
  })

  describe('renameFolder', () => {
    it('renames a folder', async () => {
      const folder = { id: 1, path: '/music', name: 'New Name' }
      mockFetcher.mockResolvedValue({ data: folder })
      const result = await renameFolder(1, 'New Name')
      expect(mockFetcher).toHaveBeenCalledWith('/api/music/folders/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      })
      expect(result).toEqual(folder)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await renameFolder(1, 'Name')
      expect(result).toBeNull()
    })
  })
})
