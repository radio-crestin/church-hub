import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createBroadcast,
  endBroadcast,
  getActiveBroadcast,
  getPastBroadcasts,
  getStreamKeys,
  getUpcomingBroadcasts,
  getYouTubeAuthStatus,
  getYouTubeConfig,
  getYoutubePlaylists,
  logoutYouTube,
  storePKCESession,
  storeYouTubeTokens,
  updateYouTubeConfig,
} from '../youtube'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

// Also mock the relative import path used in the source
vi.mock('../../../../utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('livestream/service/youtube', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('storePKCESession', () => {
    it('stores PKCE session and returns sessionId', async () => {
      mockFetcher.mockResolvedValue({
        data: { sessionId: 'abc123' },
      })
      const result = await storePKCESession({
        codeVerifier: 'verifier',
        codeChallenge: 'challenge',
      })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/youtube/pkce-session',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codeVerifier: 'verifier',
            codeChallenge: 'challenge',
          }),
        },
      )
      expect(result).toBe('abc123')
    })
  })

  describe('storeYouTubeTokens', () => {
    it('stores tokens and returns auth status', async () => {
      const authStatus = { isAuthenticated: true, channelName: 'My Channel' }
      mockFetcher.mockResolvedValue({ data: authStatus })
      const result = await storeYouTubeTokens({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: 12345,
      })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/youtube/tokens',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(result).toEqual(authStatus)
    })
  })

  describe('getYouTubeAuthStatus', () => {
    it('returns auth status', async () => {
      const status = { isAuthenticated: false }
      mockFetcher.mockResolvedValue({ data: status })
      const result = await getYouTubeAuthStatus()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/youtube/status')
      expect(result).toEqual(status)
    })
  })

  describe('logoutYouTube', () => {
    it('calls logout endpoint', async () => {
      mockFetcher.mockResolvedValue({})
      await logoutYouTube()
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/youtube/logout',
        { method: 'DELETE' },
      )
    })
  })

  describe('getYouTubeConfig', () => {
    it('returns config', async () => {
      const config = { titleTemplate: 'Live', privacyStatus: 'unlisted' }
      mockFetcher.mockResolvedValue({ data: config })
      const result = await getYouTubeConfig()
      expect(result).toEqual(config)
    })
  })

  describe('updateYouTubeConfig', () => {
    it('updates and returns config', async () => {
      const config = { titleTemplate: 'Updated' }
      mockFetcher.mockResolvedValue({ data: config })
      const result = await updateYouTubeConfig({ titleTemplate: 'Updated' })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/youtube/config',
        expect.objectContaining({ method: 'PUT' }),
      )
      expect(result).toEqual(config)
    })
  })

  describe('getStreamKeys', () => {
    it('returns stream keys', async () => {
      const keys = [{ id: 'k1', name: 'Default' }]
      mockFetcher.mockResolvedValue({ data: keys })
      const result = await getStreamKeys()
      expect(result).toEqual(keys)
    })
  })

  describe('createBroadcast', () => {
    it('creates and returns broadcast info', async () => {
      const broadcast = { broadcastId: 'b1', title: 'Live' }
      mockFetcher.mockResolvedValue({ data: broadcast })
      const result = await createBroadcast()
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/youtube/broadcast',
        { method: 'POST' },
      )
      expect(result).toEqual(broadcast)
    })
  })

  describe('getActiveBroadcast', () => {
    it('returns active broadcast', async () => {
      const broadcast = { broadcastId: 'b1' }
      mockFetcher.mockResolvedValue({ data: broadcast })
      const result = await getActiveBroadcast()
      expect(result).toEqual(broadcast)
    })

    it('returns null when no active broadcast', async () => {
      mockFetcher.mockResolvedValue({ data: null })
      const result = await getActiveBroadcast()
      expect(result).toBeNull()
    })
  })

  describe('endBroadcast', () => {
    it('ends a broadcast', async () => {
      mockFetcher.mockResolvedValue({})
      await endBroadcast('broadcast-123')
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/youtube/broadcast/broadcast-123/end',
        { method: 'PUT' },
      )
    })
  })

  describe('getUpcomingBroadcasts', () => {
    it('returns upcoming broadcasts', async () => {
      const broadcasts = [{ broadcastId: 'b1', title: 'Sunday' }]
      mockFetcher.mockResolvedValue({ data: broadcasts })
      const result = await getUpcomingBroadcasts()
      expect(result).toEqual(broadcasts)
    })
  })

  describe('getPastBroadcasts', () => {
    it('returns past broadcasts', async () => {
      const broadcasts = [{ broadcastId: 'b2', title: 'Last Week' }]
      mockFetcher.mockResolvedValue({ data: broadcasts })
      const result = await getPastBroadcasts()
      expect(result).toEqual(broadcasts)
    })
  })

  describe('getYoutubePlaylists', () => {
    it('returns playlists', async () => {
      const playlists = [{ id: 'p1', title: 'Sermons' }]
      mockFetcher.mockResolvedValue({ data: playlists })
      const result = await getYoutubePlaylists()
      expect(result).toEqual(playlists)
    })
  })
})
