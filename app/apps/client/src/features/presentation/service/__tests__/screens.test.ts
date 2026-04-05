import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('~/config', () => ({
  getApiUrl: () => 'http://localhost:3000',
  isMobile: () => false,
}))

vi.mock('~/service/api-url', () => ({
  getStoredUserToken: () => null,
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

describe('screens service', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  function mockSuccessResponse(data: unknown) {
    return mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data }),
    })
  }

  function mockErrorResponse() {
    return mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
  }

  async function importService() {
    vi.resetModules()
    vi.doMock('~/config', () => ({
      getApiUrl: () => 'http://localhost:3000',
      isMobile: () => false,
    }))
    vi.doMock('~/service/api-url', () => ({
      getStoredUserToken: () => null,
    }))
    vi.doMock('@tauri-apps/plugin-http', () => ({
      fetch: vi.fn(),
    }))
    vi.stubGlobal('fetch', mockFetch)
    return import('../../service/screens')
  }

  describe('getAllScreens', () => {
    it('fetches all screens', async () => {
      const screens = [
        { id: 1, name: 'Main', type: 'primary' },
        { id: 2, name: 'Stage', type: 'stage' },
      ]
      mockSuccessResponse(screens)

      const service = await importService()
      const result = await service.getAllScreens()

      expect(result).toEqual(screens)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.getAllScreens()).rejects.toThrow(
        'Failed to fetch screens',
      )
    })
  })

  describe('getScreenById', () => {
    it('fetches a specific screen by ID', async () => {
      const screen = { id: 1, name: 'Main', contentConfigs: {} }
      mockSuccessResponse(screen)

      const service = await importService()
      const result = await service.getScreenById(1)

      expect(result).toEqual(screen)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.getScreenById(1)).rejects.toThrow(
        'Failed to fetch screen',
      )
    })
  })

  describe('upsertScreen', () => {
    it('creates a new screen', async () => {
      const input = { name: 'New Screen', type: 'primary' as const }
      const created = { id: 3, ...input }
      mockSuccessResponse(created)

      const service = await importService()
      const result = await service.upsertScreen(input)

      expect(result).toEqual(created)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('updates an existing screen', async () => {
      const input = { id: 1, name: 'Updated Screen', type: 'stage' as const }
      mockSuccessResponse({ ...input })

      const service = await importService()
      const result = await service.upsertScreen(input)

      expect(result.name).toBe('Updated Screen')
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.upsertScreen({ name: 'X', type: 'primary' }),
      ).rejects.toThrow('Failed to save screen')
    })
  })

  describe('deleteScreen', () => {
    it('sends DELETE request for screen ID', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const service = await importService()
      await service.deleteScreen(5)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/5',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.deleteScreen(5)).rejects.toThrow(
        'Failed to delete screen',
      )
    })
  })

  describe('updateScreenContentConfig', () => {
    it('sends PUT request with content config', async () => {
      const config = {
        background: { type: 'color', color: '#000', opacity: 1 },
        mainText: {},
      }
      mockSuccessResponse(config)

      const service = await importService()
      const result = await service.updateScreenContentConfig(
        1,
        'song',
        config as never,
      )

      expect(result).toEqual(config)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/config/song',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ config }),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.updateScreenContentConfig(1, 'song', {} as never),
      ).rejects.toThrow('Failed to update screen content config')
    })
  })

  describe('updateScreenNextSlideConfig', () => {
    it('sends PUT request with next slide config', async () => {
      const config = { enabled: true, labelText: 'Next:' }
      mockSuccessResponse(config)

      const service = await importService()
      const result = await service.updateScreenNextSlideConfig(
        1,
        config as never,
      )

      expect(result).toEqual(config)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/next-slide-config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ config }),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.updateScreenNextSlideConfig(1, {} as never),
      ).rejects.toThrow('Failed to update screen next slide config')
    })
  })

  describe('updateScreenGlobalSettings', () => {
    it('sends PUT request with global settings', async () => {
      const settings = {
        defaultBackground: { type: 'color', color: '#000', opacity: 1 },
      }
      mockSuccessResponse({ id: 1, globalSettings: settings })

      const service = await importService()
      const result = await service.updateScreenGlobalSettings(
        1,
        settings as never,
      )

      expect(result.globalSettings).toEqual(settings)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/global-settings',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ settings }),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.updateScreenGlobalSettings(1, {} as never),
      ).rejects.toThrow('Failed to update screen global settings')
    })
  })

  describe('batchUpdateScreenConfig', () => {
    it('sends PUT request with all config data', async () => {
      const globalSettings = {
        defaultBackground: { type: 'color', color: '#000', opacity: 1 },
      }
      const contentConfigs = { song: {}, bible: {} }
      const nextSlideConfig = { enabled: true }
      mockSuccessResponse({ id: 1 })

      const service = await importService()
      await service.batchUpdateScreenConfig(
        1,
        globalSettings as never,
        contentConfigs as never,
        nextSlideConfig as never,
        1920,
        1080,
      )

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/batch-config',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            globalSettings,
            contentConfigs,
            nextSlideConfig,
            width: 1920,
            height: 1080,
          }),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.batchUpdateScreenConfig(1, {} as never, {} as never),
      ).rejects.toThrow('Failed to batch update screen config')
    })
  })

  describe('upsertSceneOverride', () => {
    it('sends PUT request with scene override config', async () => {
      const config = { background: { type: 'transparent' } }
      mockFetch.mockResolvedValueOnce({ ok: true })

      const service = await importService()
      await service.upsertSceneOverride(1, 'Main Camera', 'song', config)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/scene-overrides/Main%20Camera/song',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ config }),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.upsertSceneOverride(1, 'scene', 'song', {}),
      ).rejects.toThrow('Failed to upsert scene override')
    })
  })

  describe('deleteSceneOverride', () => {
    it('sends DELETE request for specific scene override', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const service = await importService()
      await service.deleteSceneOverride(1, 'Main Camera', 'bible')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/scene-overrides/Main%20Camera/bible',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.deleteSceneOverride(1, 'scene', 'song'),
      ).rejects.toThrow('Failed to delete scene override')
    })
  })

  describe('deleteAllSceneOverrides', () => {
    it('sends DELETE request for all scene overrides', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const service = await importService()
      await service.deleteAllSceneOverrides(1)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/screens/1/scene-overrides',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.deleteAllSceneOverrides(1)).rejects.toThrow(
        'Failed to delete all scene overrides',
      )
    })
  })
})
