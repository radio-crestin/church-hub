import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isAppFrontmost } from '../isAppFrontmost'
import { reclaimFocusSeries } from '../reclaimFocusSeries'

vi.mock('../isAppFrontmost', () => ({
  isAppFrontmost: vi.fn(),
}))

const frontmost = vi.mocked(isAppFrontmost)

/** Lets every pending promise settle between fake-timer steps. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

describe('reclaimFocusSeries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    frontmost.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('re-asserts focus at each delay while the app stays frontmost', async () => {
    frontmost.mockResolvedValue(true)
    const reclaim = vi.fn().mockResolvedValue(undefined)

    reclaimFocusSeries(reclaim, [200, 500])
    await flush()
    expect(reclaim).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)
    expect(reclaim).toHaveBeenCalledTimes(3)
  })

  it('never asks for focus when the app is already in the background', async () => {
    frontmost.mockResolvedValue(false)
    const reclaim = vi.fn().mockResolvedValue(undefined)

    reclaimFocusSeries(reclaim, [200, 500])
    await vi.advanceTimersByTimeAsync(1000)

    expect(reclaim).not.toHaveBeenCalled()
  })

  it('drops the pending asks once the user switches to another app', async () => {
    frontmost.mockResolvedValueOnce(true).mockResolvedValue(false)
    const reclaim = vi.fn().mockResolvedValue(undefined)

    reclaimFocusSeries(reclaim, [200, 500, 900])
    await flush()
    expect(reclaim).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    // The 200ms check finds another app in front and cancels 500/900 with it,
    // so `isAppFrontmost` is never consulted a third time.
    expect(reclaim).toHaveBeenCalledTimes(1)
    expect(frontmost).toHaveBeenCalledTimes(2)
  })

  it('stops the series when the caller cancels it', async () => {
    frontmost.mockResolvedValue(true)
    const reclaim = vi.fn().mockResolvedValue(undefined)

    const cancel = reclaimFocusSeries(reclaim, [200])
    await flush()
    cancel()
    await vi.advanceTimersByTimeAsync(1000)

    expect(reclaim).toHaveBeenCalledTimes(1)
  })
})
