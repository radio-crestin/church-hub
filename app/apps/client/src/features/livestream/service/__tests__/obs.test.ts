import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  connectToOBS,
  createOBSScene,
  deleteOBSScene,
  disconnectFromOBS,
  getOBSConfig,
  getOBSScenes,
  getOBSStatus,
  getSceneAutomation,
  getSceneShortcuts,
  reorderOBSScenes,
  startStream,
  stopStream,
  switchOBSScene,
  syncOBSScenes,
  updateOBSConfig,
  updateOBSScene,
  updateSceneAutomation,
} from '../obs'

vi.mock('~/utils/fetcher', () => ({
  fetcher: vi.fn(),
}))
vi.mock('../../../../utils/fetcher', () => ({
  fetcher: vi.fn(),
}))

import { fetcher } from '~/utils/fetcher'

const mockFetcher = vi.mocked(fetcher)

describe('livestream/service/obs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOBSStatus', () => {
    it('returns OBS status', async () => {
      const status = { connected: true, host: 'localhost', port: 4455 }
      mockFetcher.mockResolvedValue({ data: status })
      const result = await getOBSStatus()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/obs/status')
      expect(result).toEqual(status)
    })
  })

  describe('connectToOBS', () => {
    it('connects and returns status', async () => {
      const status = { connected: true }
      mockFetcher.mockResolvedValue({ data: status })
      const result = await connectToOBS()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/obs/connect', {
        method: 'POST',
      })
      expect(result).toEqual(status)
    })
  })

  describe('disconnectFromOBS', () => {
    it('disconnects and returns status', async () => {
      const status = { connected: false }
      mockFetcher.mockResolvedValue({ data: status })
      const result = await disconnectFromOBS()
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/disconnect',
        { method: 'POST' },
      )
      expect(result).toEqual(status)
    })
  })

  describe('getOBSScenes', () => {
    it('fetches all scenes', async () => {
      const scenes = [{ id: 1, obsSceneName: 'Scene 1' }]
      mockFetcher.mockResolvedValue({ data: scenes })
      const result = await getOBSScenes()
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/obs/scenes')
      expect(result).toEqual(scenes)
    })

    it('fetches visible-only scenes', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getOBSScenes(true)
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scenes?visible=true',
      )
    })

    it('fetches all scenes when visibleOnly is false', async () => {
      mockFetcher.mockResolvedValue({ data: [] })
      await getOBSScenes(false)
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/obs/scenes')
    })
  })

  describe('updateOBSScene', () => {
    it('updates a scene', async () => {
      const scene = { id: 1, displayName: 'Updated' }
      mockFetcher.mockResolvedValue({ data: scene })
      const result = await updateOBSScene(1, { displayName: 'Updated' })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scenes/1',
        expect.objectContaining({ method: 'PUT' }),
      )
      expect(result).toEqual(scene)
    })
  })

  describe('getSceneShortcuts', () => {
    it('returns shortcuts', async () => {
      const shortcuts = [{ shortcut: 'F1', sceneName: 'Scene 1' }]
      mockFetcher.mockResolvedValue({ data: shortcuts })
      const result = await getSceneShortcuts()
      expect(result).toEqual(shortcuts)
    })
  })

  describe('reorderOBSScenes', () => {
    it('reorders scenes', async () => {
      const scenes = [{ id: 2 }, { id: 1 }]
      mockFetcher.mockResolvedValue({ data: scenes })
      const result = await reorderOBSScenes([2, 1])
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scenes/reorder',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneIds: [2, 1] }),
        },
      )
      expect(result).toEqual(scenes)
    })
  })

  describe('createOBSScene', () => {
    it('creates a scene', async () => {
      const scene = { id: 3, obsSceneName: 'New Scene' }
      mockFetcher.mockResolvedValue({ data: scene })
      const result = await createOBSScene('New Scene')
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/obs/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneName: 'New Scene' }),
      })
      expect(result).toEqual(scene)
    })
  })

  describe('deleteOBSScene', () => {
    it('deletes a scene', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      await deleteOBSScene(1)
      expect(mockFetcher).toHaveBeenCalledWith('/api/livestream/obs/scenes/1', {
        method: 'DELETE',
      })
    })
  })

  describe('syncOBSScenes', () => {
    it('syncs scenes', async () => {
      const scenes = [{ id: 1 }]
      mockFetcher.mockResolvedValue({ data: scenes })
      const result = await syncOBSScenes()
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scenes/sync',
        { method: 'POST' },
      )
      expect(result).toEqual(scenes)
    })
  })

  describe('switchOBSScene', () => {
    it('switches scene', async () => {
      const response = { success: true, sceneName: 'Camera' }
      mockFetcher.mockResolvedValue({ data: response })
      const result = await switchOBSScene('Camera')
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scene/Camera',
        { method: 'POST' },
      )
      expect(result).toEqual(response)
    })

    it('encodes scene name in URL', async () => {
      mockFetcher.mockResolvedValue({
        data: { success: true, sceneName: 'My Scene' },
      })
      await switchOBSScene('My Scene')
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scene/My%20Scene',
        { method: 'POST' },
      )
    })
  })

  describe('startStream', () => {
    it('starts stream', async () => {
      const response = { success: true, broadcast: { broadcastId: 'b1' } }
      mockFetcher.mockResolvedValue({ data: response })
      const result = await startStream()
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/stream/start',
        { method: 'POST' },
      )
      expect(result).toEqual(response)
    })
  })

  describe('stopStream', () => {
    it('stops stream', async () => {
      mockFetcher.mockResolvedValue({ data: { success: true } })
      const result = await stopStream()
      expect(result).toEqual({ success: true })
    })
  })

  describe('getOBSConfig', () => {
    it('returns config', async () => {
      const config = { host: 'localhost', port: 4455 }
      mockFetcher.mockResolvedValue({ data: config })
      const result = await getOBSConfig()
      expect(result).toEqual(config)
    })
  })

  describe('updateOBSConfig', () => {
    it('updates config', async () => {
      const config = { host: '192.168.1.1', port: 4455 }
      mockFetcher.mockResolvedValue({ data: config })
      const result = await updateOBSConfig({ host: '192.168.1.1' })
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/config',
        expect.objectContaining({ method: 'PUT' }),
      )
      expect(result).toEqual(config)
    })
  })

  describe('getSceneAutomation', () => {
    it('returns automation state', async () => {
      const state = { isEnabled: true, previousSceneName: null }
      mockFetcher.mockResolvedValue({ data: state })
      const result = await getSceneAutomation()
      expect(result).toEqual(state)
    })
  })

  describe('updateSceneAutomation', () => {
    it('updates automation state', async () => {
      const state = { isEnabled: false }
      mockFetcher.mockResolvedValue({ data: state })
      const result = await updateSceneAutomation(false)
      expect(mockFetcher).toHaveBeenCalledWith(
        '/api/livestream/obs/scene-automation',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        },
      )
      expect(result).toEqual(state)
    })
  })
})
