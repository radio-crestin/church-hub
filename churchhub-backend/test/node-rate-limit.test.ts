import { describe, expect, test } from 'bun:test'
import { createMemoryRateLimiter } from '../src/node/createMemoryRateLimiter'
import { createRedisRateLimiter } from '../src/node/createRedisRateLimiter'
import { readRateLimitRule } from '../src/node/readRateLimitRule'
import { createFakeRedis } from './fakeRedis'

const RULE = { limit: 3, periodSeconds: 60 }

async function callsAllowed(limiter: RateLimit, key: string, calls: number) {
  const results = []
  for (let i = 0; i < calls; i++) results.push((await limiter.limit({ key })).success)
  return results
}

describe('createMemoryRateLimiter', () => {
  test('allows the limit per key and window, then a new window resets it', async () => {
    let now = 120_000
    const limiter = createMemoryRateLimiter(RULE, () => now)
    expect(await callsAllowed(limiter, 'a', 4)).toEqual([true, true, true, false])
    expect(await callsAllowed(limiter, 'b', 1)).toEqual([true])
    now += 60_000
    expect(await callsAllowed(limiter, 'a', 1)).toEqual([true])
  })
})

describe('createRedisRateLimiter', () => {
  test('counts per name, key and window, expiring each counter once', async () => {
    const redis = createFakeRedis()
    const limiter = createRedisRateLimiter(redis, 'SYNC', RULE, () => 120_000)
    expect(await callsAllowed(limiter, '1.2.3.4', 4)).toEqual([true, true, true, false])
    expect(redis.values.get('rl:SYNC:1.2.3.4:2')).toBe('4')
    expect(redis.ttls.get('rl:SYNC:1.2.3.4:2')).toBe(60)
  })
})

describe('readRateLimitRule', () => {
  test("defaults to the Worker's 3 a minute and reads the override", () => {
    expect(readRateLimitRule({}, 'SYNC_RATE_LIMITER')).toEqual(RULE)
    expect(
      readRateLimitRule({ SYNC_RATE_LIMIT_PER_MINUTE: '50' }, 'SYNC_RATE_LIMITER')
    ).toEqual({ limit: 50, periodSeconds: 60 })
  })

  test('rejects a value that is not a positive whole number', () => {
    expect(() =>
      readRateLimitRule({ SYNC_RATE_LIMIT_PER_MINUTE: '0' }, 'SYNC_RATE_LIMITER')
    ).toThrow()
  })
})
