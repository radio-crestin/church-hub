import { describe, expect, test } from 'bun:test'
import { createMemoryKv } from '../src/node/createMemoryKv'
import { createRedisKv } from '../src/node/createRedisKv'
import { createFakeRedis } from './fakeRedis'

describe('createMemoryKv', () => {
  test('keeps a value until its expirationTtl, then forgets it', async () => {
    let now = 1_000_000
    const kv = createMemoryKv(() => now)
    await kv.put('room:a', '{"active":true}', { expirationTtl: 60 })
    expect(await kv.get('room:a')).toBe('{"active":true}')
    expect(await kv.get('room:a', 'json')).toEqual({ active: true })
    now += 59_999
    expect(await kv.get('room:a')).not.toBeNull()
    now += 1
    expect(await kv.get('room:a')).toBeNull()
  })

  test('keeps a value without a TTL and deletes on request', async () => {
    const kv = createMemoryKv()
    await kv.put('k', 'v')
    expect(await kv.get('k')).toBe('v')
    await kv.delete('k')
    expect(await kv.get('k')).toBeNull()
  })
})

describe('createRedisKv', () => {
  test('prefixes keys, passes the TTL as EX and parses json', async () => {
    const redis = createFakeRedis()
    const kv = createRedisKv(redis)
    await kv.put('quota:x', '[1,2]', { expirationTtl: 86400 })
    expect(redis.ttls.get('kv:quota:x')).toBe(86400)
    expect(await kv.get('quota:x', 'json')).toEqual([1, 2])
    await kv.delete('quota:x')
    expect(await kv.get('quota:x')).toBeNull()
  })
})
