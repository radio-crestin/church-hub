import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/utils/fetcher')

import { fetcher } from '~/utils/fetcher'
import {
  addBookmark,
  clearBookmarks,
  getBookmarks,
  removeBookmark,
} from '../bookmarks'

const mockFetcher = vi.mocked(fetcher)

const fakeBookmark = {
  id: 1,
  songId: 10,
  songTitle: 'Amazing Grace',
  songCategoryName: 'Worship',
  songKeyLine: 'G',
  sortOrder: 0,
  createdAt: 1000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getBookmarks', () => {
  it('returns bookmarks from API', async () => {
    mockFetcher.mockResolvedValue({ data: [fakeBookmark] })
    const result = await getBookmarks()
    expect(result).toEqual([fakeBookmark])
    expect(mockFetcher).toHaveBeenCalledWith('/api/song-bookmarks')
  })

  it('returns empty array when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await getBookmarks()
    expect(result).toEqual([])
  })
})

describe('addBookmark', () => {
  it('returns created bookmark', async () => {
    mockFetcher.mockResolvedValue({ data: fakeBookmark })
    const result = await addBookmark(10)
    expect(result).toEqual(fakeBookmark)
    expect(mockFetcher).toHaveBeenCalledWith('/api/song-bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: 10 }),
    })
  })

  it('returns null when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await addBookmark(10)
    expect(result).toBeNull()
  })
})

describe('removeBookmark', () => {
  it('returns true on success', async () => {
    mockFetcher.mockResolvedValue({ success: true })
    const result = await removeBookmark(10)
    expect(result).toBe(true)
    expect(mockFetcher).toHaveBeenCalledWith('/api/song-bookmarks/10', {
      method: 'DELETE',
    })
  })

  it('returns false when success is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await removeBookmark(10)
    expect(result).toBe(false)
  })
})

describe('clearBookmarks', () => {
  it('returns true on success', async () => {
    mockFetcher.mockResolvedValue({ success: true })
    const result = await clearBookmarks()
    expect(result).toBe(true)
    expect(mockFetcher).toHaveBeenCalledWith('/api/song-bookmarks', {
      method: 'DELETE',
    })
  })

  it('returns false when success is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await clearBookmarks()
    expect(result).toBe(false)
  })
})
