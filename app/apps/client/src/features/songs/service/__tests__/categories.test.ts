import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/utils/fetcher')

import { fetcher } from '~/utils/fetcher'
import {
  deleteCategory,
  deleteUncategorizedSongs,
  getAllCategories,
  reorderCategories,
  upsertCategory,
} from '../categories'

const mockFetcher = vi.mocked(fetcher)

const fakeCategory = {
  id: 1,
  name: 'Worship',
  priority: 0,
  songCount: 5,
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAllCategories', () => {
  it('returns categories from API', async () => {
    mockFetcher.mockResolvedValue({ data: [fakeCategory] })
    const result = await getAllCategories()
    expect(result).toEqual([fakeCategory])
    expect(mockFetcher).toHaveBeenCalledWith('/api/categories')
  })

  it('returns empty array when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await getAllCategories()
    expect(result).toEqual([])
  })
})

describe('upsertCategory', () => {
  it('returns success with category on valid response', async () => {
    mockFetcher.mockResolvedValue({ data: fakeCategory })
    const result = await upsertCategory({ name: 'Worship' })
    expect(result).toEqual({ success: true, category: fakeCategory })
    expect(mockFetcher).toHaveBeenCalledWith('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Worship' }),
    })
  })

  it('returns error on failure', async () => {
    mockFetcher.mockResolvedValue({ error: 'Name already exists' })
    const result = await upsertCategory({ name: 'Duplicate' })
    expect(result).toEqual({ success: false, error: 'Name already exists' })
  })

  it('handles update with id', async () => {
    mockFetcher.mockResolvedValue({
      data: { ...fakeCategory, name: 'Updated' },
    })
    const result = await upsertCategory({ id: 1, name: 'Updated' })
    expect(result.success).toBe(true)
    expect(result.category?.name).toBe('Updated')
  })
})

describe('deleteCategory', () => {
  it('returns true on success', async () => {
    mockFetcher.mockResolvedValue({ data: { success: true } })
    const result = await deleteCategory(1)
    expect(result).toBe(true)
    expect(mockFetcher).toHaveBeenCalledWith('/api/categories/1', {
      method: 'DELETE',
    })
  })

  it('returns false when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await deleteCategory(1)
    expect(result).toBe(false)
  })

  it('returns false when success is false', async () => {
    mockFetcher.mockResolvedValue({ data: { success: false } })
    const result = await deleteCategory(1)
    expect(result).toBe(false)
  })
})

describe('deleteUncategorizedSongs', () => {
  it('returns success with deleted count', async () => {
    mockFetcher.mockResolvedValue({ data: { success: true, deletedCount: 3 } })
    const result = await deleteUncategorizedSongs()
    expect(result).toEqual({ success: true, deletedCount: 3 })
    expect(mockFetcher).toHaveBeenCalledWith('/api/categories/uncategorized', {
      method: 'DELETE',
    })
  })

  it('returns default values when data is undefined', async () => {
    mockFetcher.mockResolvedValue({})
    const result = await deleteUncategorizedSongs()
    expect(result).toEqual({ success: false, deletedCount: 0 })
  })
})

describe('reorderCategories', () => {
  it('returns success on valid response', async () => {
    mockFetcher.mockResolvedValue({ data: { success: true } })
    const result = await reorderCategories([3, 1, 2])
    expect(result).toEqual({ success: true })
    expect(mockFetcher).toHaveBeenCalledWith('/api/categories/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds: [3, 1, 2] }),
    })
  })

  it('returns error on failure', async () => {
    mockFetcher.mockResolvedValue({ error: 'Reorder failed' })
    const result = await reorderCategories([1])
    expect(result).toEqual({ success: false, error: 'Reorder failed' })
  })
})
