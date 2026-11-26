import { beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import app from '../src/index'
import { hostedRoomId } from '../src/signal/hostedRoomId'
import * as timing from '../src/utils/constantTimeEqual'
import { createMemoryKv } from '../src/node/createMemoryKv'

/**
 * The WebRTC signaling relay, on an in-memory KV. A hosted room ("h1…" id)
 * needs the host key its id comes from for every host call; a room id the
 * released apps make keeps today's behaviour, replayed here with the exact
 * requests those apps send. Run with `bun test` from churchhub-backend/.
 */
const LEGACY_ID = 'abcdefghijklmnopqrstuvwxyz012345'
const HOST_KEY = 'host-key-0123456789abcdefghijklmnopqrstuvw'
const OTHER_KEY = 'host-key-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'
const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n'

let ROOM: string
/** What the relay wrote and has not deleted, by key. */
let written: Map<string, string>
let env: Record<string, unknown>

beforeAll(async () => {
  ROOM = await hostedRoomId(HOST_KEY)
})

beforeEach(() => {
  const kv = createMemoryKv()
  written = new Map()
  env = {
    SIGNALING_KV: {
      get: kv.get.bind(kv),
      put: (key: string, value: string, options?: KVNamespacePutOptions) => {
        written.set(key, value)
        return kv.put(key, value, options)
      },
      delete: (key: string) => {
        written.delete(key)
        return kv.delete(key)
      },
    },
  }
})

function call(path: string, body?: unknown, hostKey?: string) {
  const headers: Record<string, string> = {}
  if (hostKey !== undefined) headers.Authorization = `Bearer ${hostKey}`
  if (body === undefined) {
    return app.request(`https://backend.test${path}`, { headers }, env)
  }
  headers['Content-Type'] = 'application/json'
  return app.request(
    `https://backend.test${path}`,
    {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    env
  )
}

/** The host's calls, as this version of the desktop app makes them. */
const host = (room: string) => ({
  register: (key?: string) => call('/signal/register', { secret: room }, key),
  unregister: (key?: string) => call('/signal/unregister', { secret: room }, key),
  offers: (key?: string) => call(`/signal/${room}/offers`, undefined, key),
  answer: (sessionId: string, key?: string) =>
    call(`/signal/${room}/answer`, { sessionId, answer: SDP }, key),
})

/** A listener's calls (the /listen page and the phone app make the same). */
const listener = (room: string) => ({
  check: async () => (await (await call(`/signal/${room}/check`)).json()).active,
  offer: async () => {
    const res = await call(`/signal/${room}/offer`, { offer: SDP })
    return (await res.json()).sessionId as string
  },
  answer: async (sessionId: string) =>
    (await call(`/signal/${room}/answer/${sessionId}`)).json(),
})

test('a hosted room id is "h1" and the SHA-256 of its key', async () => {
  expect(ROOM).toMatch(/^h1[A-Za-z0-9_-]{43}$/)
  expect(await hostedRoomId(OTHER_KEY)).not.toBe(ROOM)
})

describe('a hosted room', () => {
  test('relays an offer and its answer for the key holder', async () => {
    expect((await host(ROOM).register(HOST_KEY)).status).toBe(200)
    expect(await listener(ROOM).check()).toBe(true)
    const sessionId = await listener(ROOM).offer()
    const { offers } = await (await host(ROOM).offers(HOST_KEY)).json()
    expect(offers).toEqual([{ sessionId, offer: SDP }])
    expect((await host(ROOM).answer(sessionId, HOST_KEY)).status).toBe(200)
    expect(await listener(ROOM).answer(sessionId)).toEqual({ answer: SDP })
    expect((await host(ROOM).unregister(HOST_KEY)).status).toBe(200)
    expect(await listener(ROOM).check()).toBe(false)
  })

  test('stores nothing of the host key', async () => {
    await host(ROOM).register(HOST_KEY)
    const stored = [...written].flat().join()
    expect(stored).not.toContain(HOST_KEY)
  })

  test('cannot be opened without its key, nor with another key', async () => {
    expect((await host(ROOM).register()).status).toBe(401)
    expect((await host(ROOM).register(OTHER_KEY)).status).toBe(401)
    expect(await listener(ROOM).check()).toBe(false)
    expect(written.size).toBe(0)
  })

  test('cannot be claimed by concurrent registers: only the key holder wins', async () => {
    const keys = [OTHER_KEY, HOST_KEY, `${OTHER_KEY}1`, `${OTHER_KEY}2`, HOST_KEY]
    const statuses = await Promise.all(
      keys.map(async (key) => (await host(ROOM).register(key)).status)
    )
    expect(statuses).toEqual([401, 200, 401, 401, 200])
    expect((await host(ROOM).offers(OTHER_KEY)).status).toBe(401)
    expect((await host(ROOM).offers(HOST_KEY)).status).toBe(200)
  })

  describe('to a listener, holding only the room id,', () => {
    beforeEach(async () => {
      await host(ROOM).register(HOST_KEY)
    })

    test('cannot be closed', async () => {
      const res = await host(ROOM).unregister()
      expect(res.status).toBe(401)
      expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
      expect(await listener(ROOM).check()).toBe(true)
    })

    test('does not give other listeners’ pending offers', async () => {
      const sessionId = await listener(ROOM).offer()
      expect((await host(ROOM).offers()).status).toBe(401)
      const { offers } = await (await host(ROOM).offers(HOST_KEY)).json()
      expect(offers.map((o: { sessionId: string }) => o.sessionId)).toEqual([sessionId])
    })

    test('does not take an answer', async () => {
      const sessionId = await listener(ROOM).offer()
      expect((await host(ROOM).answer(sessionId)).status).toBe(401)
      expect(await listener(ROOM).answer(sessionId)).toEqual({ pending: true })
    })

    test('gives only the answer to its own offer', async () => {
      const first = await listener(ROOM).offer()
      const second = await listener(ROOM).offer()
      await host(ROOM).answer(first, HOST_KEY)
      expect(await listener(ROOM).answer(second)).toEqual({ pending: true })
      expect(await listener(ROOM).answer(first)).toEqual({ answer: SDP })
    })
  })

  test('refuses every host call with a wrong key', async () => {
    await host(ROOM).register(HOST_KEY)
    const sessionId = await listener(ROOM).offer()
    for (const key of [OTHER_KEY, '', 'short', `${HOST_KEY}x`, ROOM]) {
      expect((await host(ROOM).offers(key)).status).toBe(401)
      expect((await host(ROOM).answer(sessionId, key)).status).toBe(401)
      expect((await host(ROOM).unregister(key)).status).toBe(401)
    }
    expect(await listener(ROOM).check()).toBe(true)
  })

  test('compares the key in constant time', async () => {
    const compare = spyOn(timing, 'constantTimeEqual')
    try {
      expect((await host(ROOM).offers(OTHER_KEY)).status).toBe(401)
      expect(compare).toHaveBeenCalledTimes(1)
      expect(compare.mock.calls[0]).toEqual([await hostedRoomId(OTHER_KEY), ROOM])
      expect(compare.mock.results[0].value).toBe(false)
    } finally {
      compare.mockRestore()
    }
  })
})

/**
 * Exactly what the released desktop apps (v0.1.41 … v0.1.105, every tag)
 * send: a 32-character [a-z0-9] secret, `Content-Type: application/json`,
 * no other header (app/apps/server/src/service/live-translation/stream.ts).
 */
describe('a released app (no host key)', () => {
  const released = (secret: string) => {
    const post = (path: string, body: unknown) =>
      app.request(
        `https://backend.test${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        env
      )
    return {
      register: () => post('/signal/register', { secret }),
      unregister: () => post('/signal/unregister', { secret }),
      offers: () => app.request(`https://backend.test/signal/${secret}/offers`, {}, env),
      answer: (sessionId: string) =>
        post(`/signal/${secret}/answer`, { sessionId, answer: SDP }),
    }
  }

  test('hosts its room as before, for listeners as before', async () => {
    const old = released(LEGACY_ID)
    expect(await (await old.register()).json()).toEqual({ success: true })
    expect(await listener(LEGACY_ID).check()).toBe(true)
    const sessionId = await listener(LEGACY_ID).offer()
    const res = await old.offers()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ offers: [{ sessionId, offer: SDP }] })
    expect(await (await old.answer(sessionId)).json()).toEqual({ success: true })
    expect(await listener(LEGACY_ID).answer(sessionId)).toEqual({ answer: SDP })
    expect(await (await old.unregister()).json()).toEqual({ success: true })
    expect(await listener(LEGACY_ID).check()).toBe(false)
  })

  test('polls an empty room as before', async () => {
    expect(await (await released(LEGACY_ID).offers()).json()).toEqual({ offers: [] })
  })

  test('keeps its room when someone sends a host key for it: no claim', async () => {
    const old = released(LEGACY_ID)
    await old.register()
    expect((await host(LEGACY_ID).register(OTHER_KEY)).status).toBe(200)
    const sessionId = await listener(LEGACY_ID).offer()
    expect((await (await old.offers()).json()).offers).toHaveLength(1)
    expect((await old.answer(sessionId)).status).toBe(200)
  })

  test('cannot open or use a hosted room', async () => {
    const old = released(ROOM)
    expect((await old.register()).status).toBe(401)
    await host(ROOM).register(HOST_KEY)
    expect((await old.offers()).status).toBe(401)
    expect((await old.unregister()).status).toBe(401)
  })
})

describe('refuses', () => {
  test('a secret that is too short, too long or has other characters', async () => {
    for (const secret of ['short', 'x'.repeat(600), `${LEGACY_ID}:x`, 42]) {
      expect((await call('/signal/register', { secret })).status).toBe(400)
    }
    expect(written.size).toBe(0)
  })

  test('a body that is not JSON with a 400, not a 500', async () => {
    expect((await call('/signal/register', '{not json')).status).toBe(400)
  })

  test('an offer larger than an SDP', async () => {
    await host(ROOM).register(HOST_KEY)
    const response = await call(`/signal/${ROOM}/offer`, {
      offer: 'x'.repeat(65 * 1024),
    })
    expect(response.status).toBe(400)
    expect([...written.keys()]).toEqual([`room:${ROOM}`])
  })

  test('an offer to a room that is not open', async () => {
    expect((await call(`/signal/${ROOM}/offer`, { offer: SDP })).status).toBe(404)
  })

  test('a body over the size limit', async () => {
    const response = await call('/signal/register', {
      secret: LEGACY_ID,
      padding: 'x'.repeat(200 * 1024),
    })
    expect(response.status).toBe(413)
  })

  test('an answer for a session id that is not a UUID', async () => {
    const response = await call(`/signal/${LEGACY_ID}/answer`, {
      sessionId: 'x:y',
      answer: SDP,
    })
    expect(response.status).toBe(400)
    expect(written.size).toBe(0)
  })

  test('more pending offers than the host can take at once', async () => {
    await host(ROOM).register(HOST_KEY)
    for (let i = 0; i < 50; i++) {
      expect((await call(`/signal/${ROOM}/offer`, { offer: SDP })).status).toBe(200)
    }
    expect((await call(`/signal/${ROOM}/offer`, { offer: SDP })).status).toBe(429)
  })

  test('a listener page for a secret that cannot be a room', async () => {
    expect((await call(`/listen/${'x'.repeat(300)}`)).status).toBe(404)
  })
})
