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

// Mock window.__TAURI_INTERNALS__ to simulate non-Tauri environment
const _originalWindow = { ...window }

describe('presentation service', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    // Override window.fetch
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

  function mockErrorResponse(status = 500) {
    return mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
    })
  }

  // We need to dynamically import after mocks are set up
  async function importService() {
    // Clear module cache to pick up fresh mocks
    vi.resetModules()

    // Re-mock before import
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

    return import('../../service/presentation')
  }

  describe('getPresentationState', () => {
    it('fetches and returns presentation state', async () => {
      const mockState = {
        currentSongSlideId: 1,
        isPresenting: true,
        isHidden: false,
      }
      mockSuccessResponse(mockState)

      const service = await importService()
      const result = await service.getPresentationState()

      expect(result).toEqual(mockState)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/state',
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    it('throws on non-ok response', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(service.getPresentationState()).rejects.toThrow(
        'Failed to fetch presentation state',
      )
    })
  })

  describe('updatePresentationState', () => {
    it('sends PUT request with input and returns updated state', async () => {
      const input = { currentSongSlideId: 5, isPresenting: true }
      const mockState = { ...input, isHidden: false }
      mockSuccessResponse(mockState)

      const service = await importService()
      const result = await service.updatePresentationState(input)

      expect(result).toEqual(mockState)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/state',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(input),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(
        service.updatePresentationState({ isPresenting: false }),
      ).rejects.toThrow('Failed to update presentation state')
    })
  })

  describe('stopPresentation', () => {
    it('sends POST to stop endpoint and returns state', async () => {
      const mockState = { isPresenting: false }
      mockSuccessResponse(mockState)

      const service = await importService()
      const result = await service.stopPresentation()

      expect(result).toEqual(mockState)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/stop',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(service.stopPresentation()).rejects.toThrow(
        'Failed to stop presentation',
      )
    })
  })

  describe('clearSlide', () => {
    it('sends POST to clear endpoint', async () => {
      mockSuccessResponse({ isHidden: true })

      const service = await importService()
      const result = await service.clearSlide()

      expect(result).toEqual({ isHidden: true })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/clear',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(service.clearSlide()).rejects.toThrow(
        'Failed to clear slide',
      )
    })
  })

  describe('showSlide', () => {
    it('sends POST to show endpoint', async () => {
      mockSuccessResponse({ isHidden: false })

      const service = await importService()
      const result = await service.showSlide()

      expect(result).toEqual({ isHidden: false })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/show',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(service.showSlide()).rejects.toThrow('Failed to show slide')
    })
  })

  describe('navigateQueueSlide', () => {
    it('sends POST with next direction', async () => {
      mockSuccessResponse({ currentSongSlideId: 2 })

      const service = await importService()
      const result = await service.navigateQueueSlide('next')

      expect(result).toEqual({ currentSongSlideId: 2 })
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/navigate-queue',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ direction: 'next' }),
        }),
      )
    })

    it('sends POST with prev direction', async () => {
      mockSuccessResponse({ currentSongSlideId: 0 })

      const service = await importService()
      await service.navigateQueueSlide('prev')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ direction: 'prev' }),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(service.navigateQueueSlide('next')).rejects.toThrow(
        'Failed to navigate queue',
      )
    })
  })

  describe('presentTemporaryBible', () => {
    it('sends POST with bible input', async () => {
      const input = {
        verseId: 1,
        reference: 'John 3:16',
        text: 'For God so loved',
        translationAbbreviation: 'NIV',
        bookName: 'John',
        translationId: 1,
        bookId: 43,
        bookCode: 'JHN',
        chapter: 3,
        currentVerseIndex: 15,
      }
      mockSuccessResponse({ temporaryContent: { type: 'bible' } })

      const service = await importService()
      await service.presentTemporaryBible(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/temporary-bible',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()

      const service = await importService()
      await expect(
        service.presentTemporaryBible({
          verseId: 1,
          reference: '',
          text: '',
          translationAbbreviation: '',
          bookName: '',
          translationId: 1,
          bookId: 1,
          bookCode: '',
          chapter: 1,
          currentVerseIndex: 0,
        }),
      ).rejects.toThrow('Failed to present temporary Bible verse')
    })
  })

  describe('presentTemporarySong', () => {
    it('sends POST with song input', async () => {
      const input = { songId: 42 }
      mockSuccessResponse({ temporaryContent: { type: 'song' } })

      const service = await importService()
      await service.presentTemporarySong(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/temporary-song',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.presentTemporarySong({ songId: 1 })).rejects.toThrow(
        'Failed to present temporary song',
      )
    })
  })

  describe('navigateTemporary', () => {
    it('sends POST with direction and timestamp', async () => {
      const input = { direction: 'next' as const, requestTimestamp: 1234567890 }
      mockSuccessResponse({ temporaryContent: null })

      const service = await importService()
      await service.navigateTemporary(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/navigate-temporary',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.navigateTemporary({
          direction: 'next',
          requestTimestamp: Date.now(),
        }),
      ).rejects.toThrow('Failed to navigate temporary content')
    })
  })

  describe('clearTemporaryContent', () => {
    it('sends POST to clear-temporary endpoint', async () => {
      mockSuccessResponse({ temporaryContent: null })

      const service = await importService()
      await service.clearTemporaryContent()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/clear-temporary',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(service.clearTemporaryContent()).rejects.toThrow(
        'Failed to clear temporary content',
      )
    })
  })

  describe('presentTemporaryAnnouncement', () => {
    it('sends POST with announcement content', async () => {
      const input = { content: '<p>Hello</p>' }
      mockSuccessResponse({})

      const service = await importService()
      await service.presentTemporaryAnnouncement(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/temporary-announcement',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.presentTemporaryAnnouncement({ content: '' }),
      ).rejects.toThrow('Failed to present temporary announcement')
    })
  })

  describe('presentTemporaryBiblePassage', () => {
    it('sends POST with passage input', async () => {
      const input = {
        translationId: 1,
        translationAbbreviation: 'NIV',
        bookCode: 'GEN',
        bookName: 'Genesis',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 3,
        verses: [{ verseId: 1, verse: 1, text: 'In the beginning' }],
      }
      mockSuccessResponse({})

      const service = await importService()
      await service.presentTemporaryBiblePassage(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/temporary-bible-passage',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.presentTemporaryBiblePassage({
          translationId: 1,
          translationAbbreviation: '',
          bookCode: '',
          bookName: '',
          startChapter: 1,
          startVerse: 1,
          endChapter: 1,
          endVerse: 1,
          verses: [],
        }),
      ).rejects.toThrow('Failed to present temporary Bible passage')
    })
  })

  describe('presentTemporaryVerseteTineri', () => {
    it('sends POST with entries', async () => {
      const input = {
        entries: [
          {
            id: 1,
            personName: 'Test',
            reference: 'Ps 1:1',
            bookCode: 'PSA',
            bookName: 'Psalms',
            startChapter: 1,
            startVerse: 1,
            endChapter: 1,
            endVerse: 1,
            text: 'Blessed',
            sortOrder: 0,
          },
        ],
      }
      mockSuccessResponse({})

      const service = await importService()
      await service.presentTemporaryVerseteTineri(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/temporary-versete-tineri',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.presentTemporaryVerseteTineri({ entries: [] }),
      ).rejects.toThrow('Failed to present temporary versete tineri')
    })
  })

  describe('presentTemporaryScene', () => {
    it('sends POST with scene name', async () => {
      const input = { obsSceneName: 'Main Camera' }
      mockSuccessResponse({})

      const service = await importService()
      await service.presentTemporaryScene(input)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/presentation/temporary-scene',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('throws on failure', async () => {
      mockErrorResponse()
      const service = await importService()
      await expect(
        service.presentTemporaryScene({ obsSceneName: '' }),
      ).rejects.toThrow('Failed to present temporary scene')
    })
  })
})
