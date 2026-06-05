import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// getApiUrl is the only thing forwardErrorToServer pulls from config. Hoisted
// so the vi.mock factory can reference it.
const { getApiUrlMock } = vi.hoisted(() => ({ getApiUrlMock: vi.fn() }))
vi.mock('~/config', () => ({ getApiUrl: getApiUrlMock }))

describe('forwardErrorToServer', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Module-level queue/timer state — reset between tests with fresh modules.
    vi.resetModules()
    vi.useFakeTimers()
    getApiUrlMock.mockReturnValue('http://localhost:3000')
    fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('debounces and batches errors into a single POST', async () => {
    const { forwardErrorToServer } = await import('../forwardErrorToServer')
    forwardErrorToServer({ message: 'a', level: 'error' })
    forwardErrorToServer({ message: 'b', level: 'warning' })

    // Still debounced — nothing sent yet.
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3000/api/client-errors')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    const body = JSON.parse(init.body as string)
    expect(body.errors).toHaveLength(2)
    expect(body.errors[0].message).toBe('a')
    expect(body.errors[1].message).toBe('b')
  })

  it('drops the batch (no fetch) when no API URL is configured', async () => {
    getApiUrlMock.mockReturnValue(null)
    const { forwardErrorToServer } = await import('../forwardErrorToServer')
    forwardErrorToServer({ message: 'x' })

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when the POST rejects (swallows to avoid loops)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new Error('network down')),
    )
    const { forwardErrorToServer } = await import('../forwardErrorToServer')
    forwardErrorToServer({ message: 'boom' })

    // Draining the debounce triggers the rejecting fetch; the swallowed .catch
    // means no unhandled rejection escapes and the suite stays green.
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
