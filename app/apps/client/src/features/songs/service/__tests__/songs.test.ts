import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SongWithSlides } from '../../types'

vi.mock('~/utils/fetcher')

import { fetcher } from '~/utils/fetcher'
import {
  aiSearchSongs,
  deleteSong,
  getAllSongs,
  getSongById,
  getSongsPaginated,
  rebuildSearchIndex,
  resetSongPresentationCount,
  searchSongs,
  upsertSong,
} from '../songs'

const mockFetcher = vi.mocked(fetcher)

const fakeSong = {
  id: 1,
  title: 'Amazing Grace',
  categoryId: null,
  sourceFilename: null,
  author: null,
  copyright: null,
  ccli: null,
  tempo: null,
  timeSignature: null,
  theme: null,
  altTheme: null,
  hymnNumber: null,
  keyLine: null,
  presentationOrder: null,
  presentationCount: 0,
  lastPresentedAt: null,
  lastManualEdit: null,
  createdAt: 0,
  updatedAt: 0,
}

const fakeSongWithSlides: SongWithSlides = {
  ...fakeSong,
  slides: [],
  category: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAllSongs', () => {
  it('returns songs from API response', async () => {
    mockFetcher.mockResolvedValue({ data: [fakeSong] })
    const result = await getAllSongs()
    expect(result).toEqual([fakeSong])
    expect(mockFetcher).toHaveBeenCalledWith('/api/songs')
  })

  it('returns empty array when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await getAllSongs()
    expect(result).toEqual([])
  })
})

describe('getSongsPaginated', () => {
  it('passes limit and offset as query params', async () => {
    mockFetcher.mockResolvedValue({
      data: { songs: [fakeSong], total: 1, hasMore: false },
    })
    const result = await getSongsPaginated(10, 0)
    expect(result).toEqual({ songs: [fakeSong], total: 1, hasMore: false })
    expect(mockFetcher).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('includes filter params when provided', async () => {
    mockFetcher.mockResolvedValue({
      data: { songs: [], total: 0, hasMore: false },
    })
    await getSongsPaginated(10, 0, {
      categoryIds: [1, 2],
      presentedOnly: true,
      inSchedulesOnly: true,
      hasKeyLine: true,
      sortBy: 'title',
    })
    const url = mockFetcher.mock.calls[0][0] as string
    expect(url).toContain('categoryIds=1%2C2')
    expect(url).toContain('presentedOnly=true')
    expect(url).toContain('inSchedulesOnly=true')
    expect(url).toContain('hasKeyLine=true')
    expect(url).toContain('sortBy=title')
  })

  it('passes abort signal', async () => {
    mockFetcher.mockResolvedValue({
      data: { songs: [], total: 0, hasMore: false },
    })
    const controller = new AbortController()
    await getSongsPaginated(10, 0, undefined, controller.signal)
    expect(mockFetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('returns default value when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await getSongsPaginated(10, 0)
    expect(result).toEqual({ songs: [], total: 0, hasMore: false })
  })
})

describe('getSongById', () => {
  it('returns song with slides', async () => {
    mockFetcher.mockResolvedValue({ data: fakeSongWithSlides })
    const result = await getSongById(1)
    expect(result).toEqual(fakeSongWithSlides)
    expect(mockFetcher).toHaveBeenCalledWith('/api/songs/1')
  })

  it('returns null when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await getSongById(999)
    expect(result).toBeNull()
  })
})

describe('upsertSong', () => {
  it('returns success with data on valid response', async () => {
    mockFetcher.mockResolvedValue({ data: fakeSongWithSlides })
    const result = await upsertSong({ title: 'Test' })
    expect(result).toEqual({ success: true, data: fakeSongWithSlides })
    expect(mockFetcher).toHaveBeenCalledWith('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    })
  })

  it('handles duplicate title error', async () => {
    mockFetcher.mockResolvedValue({
      error: 'DUPLICATE_TITLE',
      existingSongId: 5,
      existingSongTitle: 'Existing Song',
    })
    const result = await upsertSong({ title: 'Existing Song' })
    expect(result.success).toBe(false)
    expect(result.isDuplicate).toBe(true)
    expect(result.existingSongId).toBe(5)
    expect(result.existingSongTitle).toBe('Existing Song')
  })

  it('handles generic error', async () => {
    mockFetcher.mockResolvedValue({ error: 'Something went wrong' })
    const result = await upsertSong({ title: 'Test' })
    expect(result).toEqual({ success: false, error: 'Something went wrong' })
  })
})

describe('deleteSong', () => {
  it('returns true on success', async () => {
    mockFetcher.mockResolvedValue({ data: { success: true } })
    const result = await deleteSong(1)
    expect(result).toBe(true)
    expect(mockFetcher).toHaveBeenCalledWith('/api/songs/1', {
      method: 'DELETE',
    })
  })

  it('returns false when data is missing', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await deleteSong(1)
    expect(result).toBe(false)
  })
})

describe('resetSongPresentationCount', () => {
  it('returns updated song on success', async () => {
    mockFetcher.mockResolvedValue({ data: fakeSongWithSlides })
    const result = await resetSongPresentationCount(1)
    expect(result).toEqual(fakeSongWithSlides)
    expect(mockFetcher).toHaveBeenCalledWith(
      '/api/songs/1/reset-presentation-count',
      { method: 'POST' },
    )
  })

  it('returns null when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await resetSongPresentationCount(1)
    expect(result).toBeNull()
  })
})

describe('searchSongs', () => {
  it('passes query as param', async () => {
    mockFetcher.mockResolvedValue({ data: [] })
    await searchSongs('grace')
    const url = mockFetcher.mock.calls[0][0] as string
    expect(url).toContain('q=grace')
  })

  it('includes categoryIds when provided', async () => {
    mockFetcher.mockResolvedValue({ data: [] })
    await searchSongs('grace', [1, 3])
    const url = mockFetcher.mock.calls[0][0] as string
    expect(url).toContain('categoryIds=1%2C3')
  })

  it('includes filter params', async () => {
    mockFetcher.mockResolvedValue({ data: [] })
    await searchSongs('grace', undefined, undefined, {
      presentedOnly: true,
      inSchedulesOnly: true,
      hasKeyLine: true,
    })
    const url = mockFetcher.mock.calls[0][0] as string
    expect(url).toContain('presentedOnly=true')
    expect(url).toContain('inSchedulesOnly=true')
    expect(url).toContain('hasKeyLine=true')
  })

  it('returns empty array when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await searchSongs('missing')
    expect(result).toEqual([])
  })
})

describe('rebuildSearchIndex', () => {
  it('returns success with duration', async () => {
    mockFetcher.mockResolvedValue({ data: { success: true, duration: 150 } })
    const result = await rebuildSearchIndex()
    expect(result).toEqual({ success: true, duration: 150 })
  })

  it('returns error on failure', async () => {
    mockFetcher.mockResolvedValue({ error: 'Index rebuild failed' })
    const result = await rebuildSearchIndex()
    expect(result).toEqual({ success: false, error: 'Index rebuild failed' })
  })

  it('defaults success to false when data is empty', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await rebuildSearchIndex()
    expect(result.success).toBe(false)
  })
})

describe('aiSearchSongs', () => {
  it('sends POST with query and categoryIds', async () => {
    const mockResponse = {
      results: [],
      termsUsed: ['grace'],
      totalCandidates: 10,
      processingTimeMs: 50,
    }
    mockFetcher.mockResolvedValue({ data: mockResponse })
    const result = await aiSearchSongs('grace', [1])
    expect(result).toEqual(mockResponse)
    expect(mockFetcher).toHaveBeenCalledWith('/api/songs/ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'grace', categoryIds: [1] }),
      signal: undefined,
    })
  })

  it('returns default response when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await aiSearchSongs('test')
    expect(result).toEqual({
      results: [],
      termsUsed: [],
      totalCandidates: 0,
      processingTimeMs: 0,
    })
  })
})
