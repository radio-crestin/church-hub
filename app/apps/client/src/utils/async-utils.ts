/**
 * Utility functions for async operations and preventing UI freezes.
 * These help keep the UI responsive during heavy operations.
 */

/**
 * Yields control back to the event loop, allowing the browser to process
 * pending events (paint, input, etc.). This prevents "not responding" issues
 * on Windows and keeps the UI responsive.
 *
 * Use this in loops or heavy operations to periodically yield.
 *
 * @example
 * for (let i = 0; i < items.length; i++) {
 *   processItem(items[i])
 *   if (i % 10 === 0) await yieldToMain()
 * }
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    // Use setTimeout(0) as it's more reliable across browsers
    // requestAnimationFrame can be paused when tab is hidden
    setTimeout(resolve, 0)
  })
}

/**
 * Yields using requestAnimationFrame, which is better for visual updates
 * but may be paused when the tab is hidden.
 */
export function yieldToNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/**
 * Yields using requestIdleCallback (with fallback to setTimeout).
 * Best for non-critical work that can wait for idle time.
 */
export function yieldToIdle(timeout = 50): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(), { timeout })
    } else {
      setTimeout(resolve, 1)
    }
  })
}

/**
 * Creates a throttled version of a function that only executes once per
 * animation frame. Useful for high-frequency events like mousemove, scroll.
 *
 * @example
 * const throttledHandler = throttleRAF((e: MouseEvent) => {
 *   updatePosition(e.clientX, e.clientY)
 * })
 * element.addEventListener('mousemove', throttledHandler)
 */
export function throttleRAF<T extends (...args: unknown[]) => void>(
  fn: T,
): (...args: Parameters<T>) => void {
  let rafId: number | null = null
  let lastArgs: Parameters<T> | null = null

  return (...args: Parameters<T>) => {
    lastArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs)
        }
        rafId = null
      })
    }
  }
}

/**
 * Processes an array in chunks, yielding to the main thread between chunks.
 * This prevents long-running loops from freezing the UI.
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param chunkSize - Number of items to process before yielding (default: 10)
 * @param onProgress - Optional callback for progress updates
 *
 * @example
 * await processInChunks(
 *   largeArray,
 *   (item) => expensiveOperation(item),
 *   20,
 *   (processed, total) => setProgress(processed / total)
 * )
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number) => R,
  chunkSize = 10,
  onProgress?: (processed: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = []
  const total = items.length

  for (let i = 0; i < total; i++) {
    results.push(processor(items[i], i))

    // Yield after each chunk
    if ((i + 1) % chunkSize === 0) {
      onProgress?.(i + 1, total)
      await yieldToMain()
    }
  }

  onProgress?.(total, total)
  return results
}

/**
 * Creates a debounced function that delays execution until after a period
 * of inactivity. Useful for search inputs, resize handlers, etc.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   searchAPI(query)
 * }, 300)
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}
