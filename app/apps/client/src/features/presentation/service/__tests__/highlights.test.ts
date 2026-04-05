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

describe('highlights service', () => {
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
    return import('../../service/highlights')
  }

  describe('getSlideHighlights', () => {
    it('fetches current slide highlights', async () => {
      const highlights = [
        { id: 'h1', start: 0, end: 5, highlight: '#FFFF00' },
        { id: 'h2', start: 10, end: 15, bold: true },
      ]
      mockSuccessResponse(highlights)

      const service = await importService()
      const result = await service.getSlideHighlights()

      expect(result).toEqual(highlights)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/highlights',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.getSlideHighlights()).rejects.toThrow(
        'Failed to fetch slide highlights',
      )
    })
  })

  describe('addSlideHighlight', () => {
    it('sends POST with highlight data and returns updated list', async () => {
      const highlight = {
        id: 'h3',
        start: 5,
        end: 10,
        highlight: '#FF0000',
      }
      const updatedHighlights = [highlight]
      mockSuccessResponse(updatedHighlights)

      const service = await importService()
      const result = await service.addSlideHighlight(highlight)

      expect(result).toEqual(updatedHighlights)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/highlights',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(highlight),
        }),
      )
    })

    it('sends highlight with bold and underline properties', async () => {
      const highlight = {
        id: 'h4',
        start: 0,
        end: 20,
        bold: true,
        underline: true,
      }
      mockSuccessResponse([highlight])

      const service = await importService()
      await service.addSlideHighlight(highlight)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(highlight),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.addSlideHighlight({
          id: 'h5',
          start: 0,
          end: 5,
        }),
      ).rejects.toThrow('Failed to add slide highlight')
    })
  })

  describe('removeSlideHighlight', () => {
    it('sends DELETE for specific highlight ID', async () => {
      const remainingHighlights = [{ id: 'h2', start: 10, end: 15, bold: true }]
      mockSuccessResponse(remainingHighlights)

      const service = await importService()
      const result = await service.removeSlideHighlight('h1')

      expect(result).toEqual(remainingHighlights)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/highlights/h1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.removeSlideHighlight('nonexistent')).rejects.toThrow(
        'Failed to remove slide highlight',
      )
    })
  })

  describe('clearSlideHighlights', () => {
    it('sends DELETE to clear all highlights', async () => {
      mockSuccessResponse([])

      const service = await importService()
      const result = await service.clearSlideHighlights()

      expect(result).toEqual([])
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/highlights',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.clearSlideHighlights()).rejects.toThrow(
        'Failed to clear slide highlights',
      )
    })
  })
})
