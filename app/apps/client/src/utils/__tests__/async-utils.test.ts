import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  debounce,
  processInChunks,
  throttleRAF,
  yieldToIdle,
  yieldToMain,
  yieldToNextFrame,
} from '../async-utils'

describe('yieldToMain', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a promise that resolves via setTimeout(0)', async () => {
    const promise = yieldToMain()
    vi.runAllTimers()
    await expect(promise).resolves.toBeUndefined()
  })

  it('allows other tasks to run before resolving', async () => {
    const order: number[] = []

    const p = yieldToMain().then(() => order.push(2))
    order.push(1)

    vi.runAllTimers()
    await p

    expect(order).toEqual([1, 2])
  })
})

describe('yieldToNextFrame', () => {
  it('resolves via requestAnimationFrame', async () => {
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0)
        return 0
      })

    await yieldToNextFrame()
    expect(rafSpy).toHaveBeenCalledOnce()

    rafSpy.mockRestore()
  })
})

describe('yieldToIdle', () => {
  it('resolves via requestIdleCallback when available', async () => {
    const mockRIC = vi.fn((cb: IdleRequestCallback) => {
      cb({} as IdleDeadline)
      return 1
    })
    vi.stubGlobal('requestIdleCallback', mockRIC)

    await yieldToIdle(100)
    expect(mockRIC).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 100,
    })

    vi.unstubAllGlobals()
  })

  it('falls back to setTimeout when requestIdleCallback is not available', async () => {
    vi.useFakeTimers()
    const original = window.requestIdleCallback
    // biome-ignore lint/performance/noDelete: test requires removing the property
    delete (window as Record<string, unknown>).requestIdleCallback

    const promise = yieldToIdle()
    vi.runAllTimers()
    await expect(promise).resolves.toBeUndefined()

    if (original) {
      vi.stubGlobal('requestIdleCallback', original)
    }
    vi.useRealTimers()
  })

  it('uses default timeout of 50', async () => {
    const mockRIC = vi.fn((cb: IdleRequestCallback) => {
      cb({} as IdleDeadline)
      return 1
    })
    vi.stubGlobal('requestIdleCallback', mockRIC)

    await yieldToIdle()
    expect(mockRIC).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 50,
    })

    vi.unstubAllGlobals()
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays function execution by the specified delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 200)

    debounced()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(199)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('resets the timer on subsequent calls', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(80)

    debounced()
    vi.advanceTimersByTime(80)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('passes the latest arguments to the function', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('first')
    debounced('second')
    debounced('third')

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('third')
  })

  it('can fire multiple times if enough time passes between calls', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('a')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith('a')

    debounced('b')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith('b')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('handles zero delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 0)

    debounced()
    vi.advanceTimersByTime(0)
    expect(fn).toHaveBeenCalledOnce()
  })
})

describe('throttleRAF', () => {
  let rafCallbacks: Array<() => void>

  beforeEach(() => {
    rafCallbacks = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb as () => void)
      return rafCallbacks.length
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRAF() {
    const cbs = [...rafCallbacks]
    rafCallbacks = []
    for (const cb of cbs) cb()
  }

  it('calls the function on the next animation frame', () => {
    const fn = vi.fn()
    const throttled = throttleRAF(fn)

    throttled('a')
    expect(fn).not.toHaveBeenCalled()

    flushRAF()
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('batches multiple calls into one per frame', () => {
    const fn = vi.fn()
    const throttled = throttleRAF(fn)

    throttled('a')
    throttled('b')
    throttled('c')

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)

    flushRAF()
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('allows a new call after the frame fires', () => {
    const fn = vi.fn()
    const throttled = throttleRAF(fn)

    throttled('first')
    flushRAF()
    expect(fn).toHaveBeenCalledWith('first')

    throttled('second')
    flushRAF()
    expect(fn).toHaveBeenCalledWith('second')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('uses the latest arguments when batching', () => {
    const fn = vi.fn()
    const throttled = throttleRAF(fn)

    throttled(1, 2)
    throttled(3, 4)

    flushRAF()
    expect(fn).toHaveBeenCalledWith(3, 4)
  })
})

describe('processInChunks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('processes all items and returns results', async () => {
    const items = [1, 2, 3, 4, 5]
    const resultPromise = processInChunks(items, (x) => x * 2, 10)

    // Flush any pending timers for yieldToMain
    vi.runAllTimers()
    const results = await resultPromise

    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it('passes index to processor', async () => {
    const items = ['a', 'b', 'c']
    const indices: number[] = []
    const resultPromise = processInChunks(
      items,
      (_item, index) => {
        indices.push(index)
        return index
      },
      10,
    )

    vi.runAllTimers()
    await resultPromise

    expect(indices).toEqual([0, 1, 2])
  })

  it('yields to main thread between chunks', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const items = Array.from({ length: 25 }, (_, i) => i)

    const resultPromise = processInChunks(items, (x) => x, 10)

    // Use runAllTimersAsync to handle the async yielding chain
    await vi.runAllTimersAsync()
    const results = await resultPromise

    expect(results).toHaveLength(25)
    // setTimeout is called for yieldToMain at chunk boundaries
    const yieldCalls = setTimeoutSpy.mock.calls.filter((call) => call[1] === 0)
    expect(yieldCalls.length).toBeGreaterThanOrEqual(2)

    setTimeoutSpy.mockRestore()
  })

  it('calls onProgress at chunk boundaries and at the end', async () => {
    const onProgress = vi.fn()
    const items = Array.from({ length: 25 }, (_, i) => i)

    const resultPromise = processInChunks(items, (x) => x, 10, onProgress)
    await vi.runAllTimersAsync()
    await resultPromise

    // Called at 10, 20, and 25 (final)
    expect(onProgress).toHaveBeenCalledWith(10, 25)
    expect(onProgress).toHaveBeenCalledWith(20, 25)
    expect(onProgress).toHaveBeenCalledWith(25, 25)
  })

  it('handles empty array', async () => {
    const onProgress = vi.fn()
    const resultPromise = processInChunks([], (x) => x, 10, onProgress)
    vi.runAllTimers()
    const results = await resultPromise

    expect(results).toEqual([])
    // onProgress is called with (0, 0) at the end
    expect(onProgress).toHaveBeenCalledWith(0, 0)
  })

  it('handles chunk size larger than array', async () => {
    const items = [1, 2, 3]
    const resultPromise = processInChunks(items, (x) => x * 10, 100)
    vi.runAllTimers()
    const results = await resultPromise

    expect(results).toEqual([10, 20, 30])
  })

  it('uses default chunk size of 10', async () => {
    const onProgress = vi.fn()
    const items = Array.from({ length: 15 }, (_, i) => i)

    const resultPromise = processInChunks(
      items,
      (x) => x,
      undefined,
      onProgress,
    )
    vi.runAllTimers()
    await resultPromise

    // With default chunkSize=10, yields at index 9 (i+1=10)
    expect(onProgress).toHaveBeenCalledWith(10, 15)
    expect(onProgress).toHaveBeenCalledWith(15, 15)
  })

  it('works without onProgress callback', async () => {
    const items = [1, 2, 3]
    const resultPromise = processInChunks(items, (x) => x + 1, 2)
    vi.runAllTimers()
    const results = await resultPromise

    expect(results).toEqual([2, 3, 4])
  })
})
