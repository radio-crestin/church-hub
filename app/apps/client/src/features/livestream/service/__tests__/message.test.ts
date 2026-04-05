import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateBroadcastMessage } from '../message'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))
vi.mock('../../../../utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('livestream/service/message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateBroadcastMessage', () => {
    it('generates message without broadcast URL', async () => {
      mockFetcher.mockResolvedValue({
        data: { message: 'We are live!' },
      })
      const result = await generateBroadcastMessage()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/message')
      expect(result).toBe('We are live!')
    })

    it('generates message with broadcast URL', async () => {
      mockFetcher.mockResolvedValue({
        data: { message: 'Watch at https://youtube.com/live/abc' },
      })
      const result = await generateBroadcastMessage(
        'https://youtube.com/live/abc',
      )
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/message?broadcastUrl=https%3A%2F%2Fyoutube.com%2Flive%2Fabc',
      )
      expect(result).toBe('Watch at https://youtube.com/live/abc')
    })
  })
})
