import type { RedisCommands } from '../src/node/types'

/** Just enough of a Redis client for the adapters' tests (no expiry clock). */
export function createFakeRedis() {
  const values = new Map<string, string>()
  const ttls = new Map<string, number>()
  const redis: RedisCommands = {
    async get(key) {
      return values.get(key) ?? null
    },
    async set(key, value, options) {
      values.set(key, value)
      if (options) ttls.set(key, options.expiration.value)
    },
    async del(key) {
      values.delete(key)
    },
    async incr(key) {
      const next = Number(values.get(key) ?? 0) + 1
      values.set(key, String(next))
      return next
    },
    async expire(key, seconds) {
      ttls.set(key, seconds)
    },
  }
  return Object.assign(redis, { values, ttls })
}
