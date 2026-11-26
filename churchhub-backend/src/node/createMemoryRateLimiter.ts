import type { RateLimitRule } from './types'

/**
 * A Workers rate-limit binding in this process's memory: at most
 * `rule.limit` calls per key in each fixed window. Safe only with one replica.
 */
export function createMemoryRateLimiter(
  rule: RateLimitRule,
  now: () => number = Date.now
): RateLimit {
  const counts = new Map<string, { window: number; count: number }>()
  return {
    async limit({ key }) {
      const window = Math.floor(now() / (rule.periodSeconds * 1000))
      const current = counts.get(key)
      const count = current?.window === window ? current.count + 1 : 1
      counts.set(key, { window, count })
      if (counts.size > 10_000) dropOldWindows(counts, window)
      return { success: count <= rule.limit }
    },
  }
}

function dropOldWindows(
  counts: Map<string, { window: number }>,
  window: number
): void {
  for (const [key, entry] of counts) {
    if (entry.window !== window) counts.delete(key)
  }
}
