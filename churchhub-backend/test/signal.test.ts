import { beforeEach, describe, expect, test } from 'bun:test'
import app from '../src/index'

/**
 * The WebRTC signaling relay, on an in-memory KV: the happy path, and the
 * inputs it refuses before they reach KV. Run with `bun test` from
 * churchhub-backend/.
 */
const SECRET = 'abcdefghijklmnopqrstuvwxyz012345'
const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n'

let kv: Map<string, string>
let env: Record<string, unknown>

beforeEach(() => {
  kv = new Map()
  env = {
    SIGNALING_KV: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => void kv.set(key, value),
      delete: async (key: string) => void kv.delete(key),
    },
  }
})

function call(path: string, body?: unknown) {
  return app.request(
    `https://backend.test${path}`,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: typeof body === 'string' ? body : JSON.stringify(body),
        },
    env
  )
}

test('relays an offer and its answer through a registered room', async () => {
  expect((await call('/signal/register', { secret: SECRET })).status).toBe(200)
  const { sessionId } = await (
    await call(`/signal/${SECRET}/offer`, { offer: SDP })
  ).json()
  const { offers } = await (await call(`/signal/${SECRET}/offers`)).json()
  expect(offers).toEqual([{ sessionId, offer: SDP }])
  await call(`/signal/${SECRET}/answer`, { sessionId, answer: SDP })
  expect(
    await (await call(`/signal/${SECRET}/answer/${sessionId}`)).json()
  ).toEqual({ answer: SDP })
})

describe('refuses', () => {
  test('a secret that is too short, too long or has other characters', async () => {
    for (const secret of ['short', 'x'.repeat(600), `${SECRET}:x`, 42]) {
      expect((await call('/signal/register', { secret })).status).toBe(400)
    }
    expect(kv.size).toBe(0)
  })

  test('a body that is not JSON with a 400, not a 500', async () => {
    expect((await call('/signal/register', '{not json')).status).toBe(400)
  })

  test('an offer larger than an SDP', async () => {
    await call('/signal/register', { secret: SECRET })
    const response = await call(`/signal/${SECRET}/offer`, {
      offer: 'x'.repeat(65 * 1024),
    })
    expect(response.status).toBe(400)
    expect([...kv.keys()]).toEqual([`room:${SECRET}`])
  })

  test('a body over the size limit', async () => {
    const response = await call('/signal/register', {
      secret: SECRET,
      padding: 'x'.repeat(200 * 1024),
    })
    expect(response.status).toBe(413)
  })

  test('an answer for a session id that is not a UUID', async () => {
    const response = await call(`/signal/${SECRET}/answer`, {
      sessionId: 'x:y',
      answer: SDP,
    })
    expect(response.status).toBe(400)
    expect(kv.size).toBe(0)
  })

  test('more pending offers than the host can take at once', async () => {
    await call('/signal/register', { secret: SECRET })
    for (let i = 0; i < 50; i++) {
      expect((await call(`/signal/${SECRET}/offer`, { offer: SDP })).status).toBe(200)
    }
    expect((await call(`/signal/${SECRET}/offer`, { offer: SDP })).status).toBe(429)
  })

  test('a listener page for a secret that cannot be a room', async () => {
    expect((await call(`/listen/${'x'.repeat(300)}`)).status).toBe(404)
  })
})
