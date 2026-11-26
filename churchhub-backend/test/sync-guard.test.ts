import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createSyncGuard } from '../src/node/createSyncGuard'
import type { Bindings } from '../src/types'

const ENV = {
  SYNC_SECRET: 'secret',
  S3_ENDPOINT: 'https://s3.example.com',
  S3_BUCKET: 'public-bucket',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_PUBLIC_URL: 'https://s3.example.com/public-bucket',
} as unknown as Bindings

let realFetch: typeof fetch
beforeEach(() => (realFetch = globalThis.fetch))
afterEach(() => (globalThis.fetch = realFetch))

/** A bucket that honours conditions (or ignores them, `honours: false`). */
function fakeBucket(honours: boolean) {
  const objects = new Map<string, string>()
  let version = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const key = new URL(request.url).pathname
    if (request.method === 'DELETE') {
      objects.delete(key)
      return new Response(null, { status: 204 })
    }
    const current = objects.get(key)
    const ifNoneMatch = request.headers.get('If-None-Match')
    const ifMatch = request.headers.get('If-Match')
    if (honours && ((ifNoneMatch === '*' && current) || (ifMatch && ifMatch !== current))) {
      return new Response(null, { status: 412 })
    }
    const etag = `"${++version}"`
    objects.set(key, etag)
    return new Response(null, { status: 200, headers: { ETag: etag } })
  }) as typeof fetch
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('createSyncGuard', () => {
  test('keeps SYNC_SECRET once the bucket honours conditional writes', async () => {
    fakeBucket(true)
    const bindingsFor = createSyncGuard(ENV)
    expect(bindingsFor().SYNC_SECRET).toBeUndefined()
    await settle()
    expect(bindingsFor().SYNC_SECRET).toBe('secret')
  })

  test('withholds SYNC_SECRET for good when the bucket ignores them', async () => {
    fakeBucket(false)
    const bindingsFor = createSyncGuard(ENV)
    await settle()
    expect(bindingsFor().SYNC_SECRET).toBeUndefined()
    expect(bindingsFor().S3_ENDPOINT).toBe('https://s3.example.com')
  })

  test('passes the bindings through when sync is not configured', () => {
    const env = { ...ENV, S3_ENDPOINT: undefined } as unknown as Bindings
    expect(createSyncGuard(env)()).toBe(env)
  })
})
