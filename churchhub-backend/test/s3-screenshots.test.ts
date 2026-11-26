import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createS3ScreenshotStore } from '../src/feature-requests/createS3ScreenshotStore'
import { getScreenshotStore } from '../src/feature-requests/getScreenshotStore'
import type { Bindings } from '../src/types'

const SETTINGS = {
  S3_ENDPOINT: 'https://s3.example.com/',
  S3_BUCKET: 'public-bucket',
  S3_STATE_BUCKET: 'state-bucket',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_REGION: 'eu-1',
} as unknown as Bindings

let realFetch: typeof fetch
let requests: Request[]
let stored: Map<string, { body: ArrayBuffer; type: string }>

beforeEach(() => {
  realFetch = globalThis.fetch
  requests = []
  stored = new Map()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    const key = new URL(request.url).pathname
    if (request.method === 'PUT') {
      stored.set(key, {
        body: await request.arrayBuffer(),
        type: request.headers.get('Content-Type') ?? '',
      })
      return new Response(null, { status: 200 })
    }
    const object = stored.get(key)
    if (!object) return new Response('<Error/>', { status: 404 })
    return new Response(object.body, { headers: { 'Content-Type': object.type } })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const PNG = { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png', extension: 'png' }

describe('createS3ScreenshotStore', () => {
  test('stores under feature-requests/ in the state bucket, signed, and reads back', async () => {
    const store = createS3ScreenshotStore(SETTINGS)
    const id = await store.save(PNG)
    expect(id).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(requests[0].url).toBe(`https://s3.example.com/state-bucket/feature-requests/${id}`)
    expect(requests[0].headers.get('Authorization')).toContain('AWS4-HMAC-SHA256')

    const object = await store.load(id)
    expect(object?.contentType).toBe('image/png')
    expect([...new Uint8Array(await new Response(object?.body).arrayBuffer())]).toEqual([1, 2, 3])
  })

  test('prefers FEATURE_REQUEST_S3_BUCKET and answers null for a missing id', async () => {
    const store = createS3ScreenshotStore({ ...SETTINGS, FEATURE_REQUEST_S3_BUCKET: 'screens' })
    expect(await store.load('missing.png')).toBeNull()
    expect(requests[0].url).toContain('/screens/feature-requests/missing.png')
  })

  test('throws without leaking the storage error body', async () => {
    globalThis.fetch = (async () =>
      new Response('<Key>secret-path</Key>', { status: 403 })) as unknown as typeof fetch
    await expect(createS3ScreenshotStore(SETTINGS).load('x.png')).rejects.toThrow(
      'Screenshot storage GET failed: 403'
    )
  })
})

describe('getScreenshotStore', () => {
  test('uses S3 when there is no R2 binding', async () => {
    await getScreenshotStore(SETTINGS).save(PNG)
    expect(requests[0].url).toContain('/state-bucket/feature-requests/')
  })
})
