import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addItemToSchedule,
  deleteSchedule,
  getAllSchedules,
  getScheduleById,
  removeItemFromSchedule,
  reorderScheduleItems,
  replaceScheduleItems,
  searchSchedules,
  updateScheduleSlide,
  upsertSchedule,
} from '../schedules'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('schedules/service/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllSchedules', () => {
    it('returns all schedules', async () => {
      const schedules = [{ id: 1, title: 'Sunday Service' }]
      mockFetcher.mockResolvedValue({ data: schedules })
      const result = await getAllSchedules()
      expect(mockFetcher).toHaveBeenCalledWith('/api/schedules')
      expect(result).toEqual(schedules)
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getAllSchedules()
      expect(result).toEqual([])
    })
  })

  describe('getScheduleById', () => {
    it('returns schedule with items', async () => {
      const schedule = { id: 1, title: 'Sunday', items: [] }
      mockFetcher.mockResolvedValue({ data: schedule })
      const result = await getScheduleById(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/schedules/1')
      expect(result).toEqual(schedule)
    })

    it('returns null when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await getScheduleById(999)
      expect(result).toBeNull()
    })
  })

  describe('upsertSchedule', () => {
    it('creates a schedule successfully', async () => {
      const schedule = { id: 1, title: 'New Schedule' }
      mockFetcher.mockResolvedValue({ data: schedule })
      const result = await upsertSchedule({ title: 'New Schedule' })
      expect(mockFetcher).toHaveBeenCalledWith('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Schedule' }),
      })
      expect(result).toEqual({ success: true, data: schedule })
    })

    it('returns error when response has error', async () => {
      mockFetcher.mockResolvedValue({
        error: 'Title already exists',
      })
      const result = await upsertSchedule({ title: 'Duplicate' })
      expect(result).toEqual({
        success: false,
        error: 'Title already exists',
      })
    })

    it('updates an existing schedule', async () => {
      const schedule = { id: 5, title: 'Updated' }
      mockFetcher.mockResolvedValue({ data: schedule })
      const result = await upsertSchedule({ id: 5, title: 'Updated' })
      expect(result).toEqual({ success: true, data: schedule })
    })
  })

  describe('deleteSchedule', () => {
    it('deletes and returns true', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await deleteSchedule(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/schedules/1', {
        method: 'DELETE',
      })
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await deleteSchedule(1)
      expect(result).toBe(false)
    })
  })

  describe('searchSchedules', () => {
    it('searches with encoded query', async () => {
      const results = [{ id: 1, title: 'Match', matchedContent: 'test' }]
      mockFetcher.mockResolvedValue({ data: results })
      const result = await searchSchedules('test query')
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/schedules/search?q=test%20query',
      )
      expect(result).toEqual(results)
    })

    it('returns empty array when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await searchSchedules('nothing')
      expect(result).toEqual([])
    })
  })

  describe('addItemToSchedule', () => {
    it('adds an item successfully', async () => {
      const item = { id: 10, scheduleId: 1, itemType: 'song' }
      mockFetcher.mockResolvedValue({ data: item })
      const result = await addItemToSchedule(1, { songId: 5 })
      expect(mockFetcher).toHaveBeenCalledWith('/api/schedules/1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: 5 }),
      })
      expect(result).toEqual({ success: true, data: item })
    })

    it('returns error on failure', async () => {
      mockFetcher.mockResolvedValue({ error: 'Song not found' })
      const result = await addItemToSchedule(1, { songId: 999 })
      expect(result).toEqual({ success: false, error: 'Song not found' })
    })
  })

  describe('removeItemFromSchedule', () => {
    it('removes item and returns true', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await removeItemFromSchedule(1, 10)
      expect(mockFetcher).toHaveBeenCalledWith('/api/schedules/1/items/10', {
        method: 'DELETE',
      })
      expect(result).toBe(true)
    })

    it('returns false when data is undefined', async () => {
      mockFetcher.mockResolvedValue({})
      const result = await removeItemFromSchedule(1, 10)
      expect(result).toBe(false)
    })
  })

  describe('updateScheduleSlide', () => {
    it('updates slide successfully', async () => {
      const item = { id: 10, slideType: 'announcement' }
      mockFetcher.mockResolvedValue({ data: item })
      const result = await updateScheduleSlide(1, 10, {
        slideType: 'announcement',
        slideContent: '<p>Hello</p>',
      })
      expect(result).toEqual({ success: true, data: item })
    })

    it('returns error on failure', async () => {
      mockFetcher.mockResolvedValue({ error: 'Not found' })
      const result = await updateScheduleSlide(1, 10, {
        slideType: 'announcement',
      })
      expect(result).toEqual({ success: false, error: 'Not found' })
    })
  })

  describe('reorderScheduleItems', () => {
    it('reorders items', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await reorderScheduleItems(1, { itemIds: [3, 1, 2] })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/schedules/1/items/reorder',
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
      const result = await reorderScheduleItems(1, { itemIds: [1] })
      expect(result).toBe(false)
    })
  })

  describe('replaceScheduleItems', () => {
    it('replaces items successfully', async () => {
      mockFetcher.mockResolvedValue({
        data: {
          success: true,
          schedule: { id: 1, title: 'Test', itemCount: 2 },
        },
      })
      const result = await replaceScheduleItems(1, {
        items: [{ type: 'song', songId: 5 }],
      })
      expect(result.success).toBe(true)
      expect(result.schedule).toEqual({
        id: 1,
        title: 'Test',
        itemCount: 2,
      })
    })

    it('returns error on failure', async () => {
      mockFetcher.mockResolvedValue({ error: 'Failed' })
      const result = await replaceScheduleItems(1, { items: [] })
      expect(result).toEqual({ success: false, error: 'Failed' })
    })

    it('includes skipped items in response', async () => {
      mockFetcher.mockResolvedValue({
        data: {
          success: true,
          skippedItems: [
            {
              index: 0,
              type: 'bible_passage',
              reference: 'Unknown 1:1',
              reason: 'Not found',
            },
          ],
        },
      })
      const result = await replaceScheduleItems(1, { items: [] })
      expect(result.skippedItems).toHaveLength(1)
    })
  })
})
