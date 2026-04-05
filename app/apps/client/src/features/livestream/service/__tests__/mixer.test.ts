import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getMixerChannels,
  getMixerConfig,
  testMixerConnection,
  updateMixerChannels,
  updateMixerConfig,
} from '../mixer'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))
vi.mock('../../../../utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('livestream/service/mixer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMixerConfig', () => {
    it('returns mixer config', async () => {
      const config = { host: '192.168.1.50', port: 10024, isEnabled: true }
      mockFetcher.mockResolvedValue({ data: config })
      const result = await getMixerConfig()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/mixer/config')
      expect(result).toEqual(config)
    })
  })

  describe('updateMixerConfig', () => {
    it('updates and returns config', async () => {
      const config = { host: '10.0.0.1', port: 10024 }
      mockFetcher.mockResolvedValue({ data: config })
      const result = await updateMixerConfig({ host: '10.0.0.1' })
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/mixer/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: '10.0.0.1' }),
      })
      expect(result).toEqual(config)
    })
  })

  describe('getMixerChannels', () => {
    it('returns channels', async () => {
      const channels = [
        { channelNumber: 1, label: 'Vocals' },
        { channelNumber: 2, label: 'Guitar' },
      ]
      mockFetcher.mockResolvedValue({ data: channels })
      const result = await getMixerChannels()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/mixer/channels')
      expect(result).toEqual(channels)
    })
  })

  describe('updateMixerChannels', () => {
    it('updates channels', async () => {
      const channels = [{ channelNumber: 1, label: 'New Label' }]
      mockFetcher.mockResolvedValue({ data: channels })
      const result = await updateMixerChannels(channels)
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/mixer/channels',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channels }),
        },
      )
      expect(result).toEqual(channels)
    })
  })

  describe('testMixerConnection', () => {
    it('returns success on good connection', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await testMixerConnection()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/mixer/test', {
        method: 'POST',
      })
      expect(result).toEqual({ success: true })
    })

    it('returns error on bad connection', async () => {
      mockFetcher.mockResolvedValue({
        data: { success: false, error: 'Connection refused' },
      })
      const result = await testMixerConnection()
      expect(result).toEqual({ success: false, error: 'Connection refused' })
    })
  })
})
