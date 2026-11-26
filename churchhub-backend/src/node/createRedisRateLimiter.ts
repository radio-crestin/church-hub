import type { RateLimitRule, RedisCommands } from './types'

/**
 * A Workers rate-limit binding in Redis, shared by every replica: at most
 * `rule.limit` calls per key in each fixed window (INCR + EXPIRE).
 */
export function createRedisRateLimiter(
  redis: RedisCommands,
  name: string,
  rule: RateLimitRule,
  now: () => number = Date.now
): RateLimit {
  return {
    async limit({ key }) {
      const window = Math.floor(now() / (rule.periodSeconds * 1000))
      const counter = `rl:${name}:${key}:${window}`
      const count = await redis.incr(counter)
      if (count === 1) await redis.expire(counter, rule.periodSeconds)
      return { success: count <= rule.limit }
    },
  }
}
