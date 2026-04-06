import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies before importing fetcher
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

vi.mock('~/config', () => ({
  isMobile: vi.fn(() => false),
}))

vi.mock('~/service/api-url', () => ({
  getStoredApiUrl: vi.fn(() => null),
  getStoredUserToken: vi.fn(() => null),
}))

vi.mock('~/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('fetcher', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    // Set up the spy BEFORE module loads so fetchFn captures it
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    // Reset module registry so fetcher re-evaluates fetchFn with our spy
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function getFetcher() {
    const mod = await import('../fetcher')
    return mod.fetcher
  }

  function mockFetchResponse(data: unknown, status = 200) {
    fetchSpy.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    })
  }

  function mockFetchHang() {
    fetchSpy.mockImplementation(
      (_url: string, options?: RequestInit) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
  }

  it('returns parsed JSON on successful response', async () => {
    mockFetchResponse({ data: { id: 1 } })
    const fetcher = await getFetcher()

    const result = await fetcher('/api/test')
    expect(result).toEqual({ data: { id: 1 } })
  })

  it('passes signal to fetch for timeout control', async () => {
    mockFetchResponse({ data: 'ok' })
    const fetcher = await getFetcher()

    await fetcher('/api/test')

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('throws TimeoutError when request exceeds default timeout', async () => {
    mockFetchHang()
    const fetcher = await getFetcher()

    const promise = fetcher('/api/slow')

    vi.advanceTimersByTime(15_000)

    await expect(promise).rejects.toThrow('timed out after 15000ms')
    await expect(promise).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('throws TimeoutError when request exceeds custom timeout', async () => {
    mockFetchHang()
    const fetcher = await getFetcher()

    const promise = fetcher('/api/slow', { timeout: 5000 })

    vi.advanceTimersByTime(5000)

    await expect(promise).rejects.toThrow('timed out after 5000ms')
    await expect(promise).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('does not timeout if response arrives before deadline', async () => {
    mockFetchResponse({ data: 'fast' })
    const fetcher = await getFetcher()

    const result = await fetcher('/api/fast', { timeout: 5000 })
    expect(result).toEqual({ data: 'fast' })
  })

  it('clears timeout after successful response', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    mockFetchResponse({ data: 'ok' })
    const fetcher = await getFetcher()

    await fetcher('/api/test')

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('clears timeout after fetch error', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    fetchSpy.mockRejectedValue(new Error('Network error'))
    const fetcher = await getFetcher()

    await expect(fetcher('/api/fail')).rejects.toThrow('Network error')
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('respects caller abort signal', async () => {
    const callerController = new AbortController()
    mockFetchHang()
    const fetcher = await getFetcher()

    const promise = fetcher('/api/test', { signal: callerController.signal })

    callerController.abort()

    // Should throw the original abort error, not a TimeoutError
    await expect(promise).rejects.toThrow()
    try {
      await promise
    } catch (error) {
      expect((error as Error).name).not.toBe('TimeoutError')
    }
  })

  it('includes method and url in timeout error message', async () => {
    mockFetchHang()
    const fetcher = await getFetcher()

    const promise = fetcher('/api/data', { method: 'POST', timeout: 1000 })
    vi.advanceTimersByTime(1000)

    await expect(promise).rejects.toThrow(
      'API POST /api/data timed out after 1000ms',
    )
  })

  it('returns parsed body for non-ok responses', async () => {
    mockFetchResponse({ error: 'not found' }, 404)
    const fetcher = await getFetcher()

    const result = await fetcher('/api/missing')
    expect(result).toEqual({ error: 'not found' })
  })
})
