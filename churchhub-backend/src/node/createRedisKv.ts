import type { RedisCommands } from './types'

const PREFIX = 'kv:'

/**
 * The part of a Workers KV namespace the app uses, in Redis: shared by every
 * replica, with each value's `expirationTtl` as its Redis expiry.
 */
export function createRedisKv(redis: RedisCommands): KVNamespace {
  const kv = {
    async get(key: string, type?: 'text' | 'json') {
      const value = await redis.get(PREFIX + key)
      if (value === null || type !== 'json') return value
      return JSON.parse(value)
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number }
    ) {
      const ttl = options?.expirationTtl
      await redis.set(
        PREFIX + key,
        value,
        ttl ? { expiration: { type: 'EX', value: Math.ceil(ttl) } } : undefined
      )
    },
    async delete(key: string) {
      await redis.del(PREFIX + key)
    },
  }
  return kv as unknown as KVNamespace
}
