import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import app from '../src/index'

/**
 * Drives POST /feature-requests through the real Hono app with GitHub and
 * WAHA replaced by a fetch stub, an in-memory KV and R2 bucket, and a
 * rate limiter stub.
 * Run with `bun test` from churchhub-backend/.
 */
const EMAIL = 'pastor@example.com'
const CLIENT_IP = '203.0.113.7'
const DAY_MS = 24 * 60 * 60 * 1000
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

interface RecordedCall {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

let calls: RecordedCall[]
let realFetch: typeof fetch
let limiterAllows: boolean

function createKv() {
  const values = new Map<string, string>()
  return {
    values,
    async get(key: string, type?: 'json') {
      const value = values.get(key)
      if (value === undefined) return null
      return type === 'json' ? JSON.parse(value) : value
    },
    async put(key: string, value: string) {
      values.set(key, value)
    },
  }
}

function createBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>()
  return {
    objects,
    async put(
      key: string,
      bytes: Uint8Array,
      options: { httpMetadata: { contentType: string } }
    ) {
      objects.set(key, { bytes, contentType: options.httpMetadata.contentType })
    },
    async get(key: string) {
      const object = objects.get(key)
      if (!object) return null
      return {
        body: new Response(object.bytes).body,
        httpMetadata: { contentType: object.contentType },
      }
    },
  }
}

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    GITHUB_TOKEN: 'test-github-token',
    COOKIE_ENCRYPTION_KEY: 'test-cookie-key',
    SIGNALING_KV: createKv(),
    FEATURE_REQUEST_SCREENSHOTS: createBucket(),
    WAHA_URL: 'https://waha.test/',
    WAHA_API_KEY: 'test-waha-key',
    WAHA_CHAT_ID: '40700000000@c.us',
    FEATURE_REQUEST_RATE_LIMITER: {
      limit: async () => ({ success: limiterAllows }),
    },
    ...overrides,
  }
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Bigger song font',
    notes: 'Please let me pick the font size. cc @someone',
    email: EMAIL,
    route: '/songs',
    viewport: '1280x800',
    osVersion: 'macOS 15',
    appVersion: '0.1.102',
    element: {
      selector: 'body > div:nth-of-type(1) > main > button:nth-of-type(2)',
      path: 'div#root > main > button[data-testid="font-size"]',
      label: 'Font size',
    },
    screenshot: PNG_DATA_URL,
    supportId: 'ph-123',
    ...overrides,
  }
}

function post(body: unknown, env = createEnv()) {
  return app.request(
    'https://backend.test/feature-requests',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': CLIENT_IP,
      },
      body: JSON.stringify(body),
    },
    env
  )
}

beforeEach(() => {
  calls = []
  limiterAllows = true
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? '{}')),
    })
    if (url.startsWith('https://api.github.com/')) {
      return Response.json({
        html_url: 'https://github.com/radio-crestin/church-hub/issues/42',
        number: 42,
      })
    }
    return Response.json({ id: 'sent' })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('POST /feature-requests', () => {
  test('creates a public issue without the email and notifies WhatsApp with it', async () => {
    const env = createEnv()
    const response = await post(validBody(), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      issueUrl: 'https://github.com/radio-crestin/church-hub/issues/42',
      issueNumber: 42,
      whatsAppSent: true,
    })

    // GitHub is only asked to create the issue: nothing is written to the repo.
    expect(calls).toHaveLength(2)
    const [github, waha] = calls
    expect(github.url).toBe(
      'https://api.github.com/repos/radio-crestin/church-hub/issues'
    )
    expect(github.body.title).toBe('Bigger song font')
    const issueBody = String(github.body.body)
    expect(issueBody).not.toContain(EMAIL)
    expect(issueBody).toContain('button[data-testid="font-size"]')
    expect(issueBody).toContain('@​someone')
    expect(issueBody).toMatch(
      /!\[Screenshot\]\(https:\/\/backend\.test\/feature-requests\/screenshots\/[0-9a-f-]{36}\.png\)/
    )
    const [stored] = [...env.FEATURE_REQUEST_SCREENSHOTS.objects.values()]
    expect(stored.contentType).toBe('image/png')

    expect(waha.url).toBe('https://waha.test/api/sendText')
    expect(waha.headers['X-Api-Key']).toBe('test-waha-key')
    expect(waha.body.session).toBe('default')
    expect(waha.body.chatId).toBe('40700000000@c.us')
    const text = String(waha.body.text)
    expect(text).toContain('Bigger song font')
    expect(text).toContain(EMAIL)
    expect(text).toContain('Please let me pick the font size.')
    expect(text).toContain('issues/42')
    expect(text).toContain('*Support ID:* ph-123')
  })

  test('serves the stored screenshot with its type and a long cache', async () => {
    const env = createEnv()
    await post(validBody(), env)
    const screenshotUrl = /\((https:\/\/backend\.test[^)]+)\)/.exec(
      String(calls[0].body.body)
    )?.[1]

    const response = await app.request(screenshotUrl as string, {}, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toContain('immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      Uint8Array.from(atob(PNG_DATA_URL.split(',')[1]), (c) => c.charCodeAt(0))
    )
  })

  test('404s screenshot ids that are unknown or not a random id', async () => {
    const env = createEnv()
    const unknown = await app.request(
      'https://backend.test/feature-requests/screenshots/00000000-0000-0000-0000-000000000000.png',
      {},
      env
    )
    expect(unknown.status).toBe(404)
    const notAnId = await app.request(
      'https://backend.test/feature-requests/screenshots/..%2Fsecret.png',
      {},
      env
    )
    expect(notAnId.status).toBe(404)
  })

  test('stores nothing when there is no screenshot', async () => {
    const env = createEnv()
    const response = await post(validBody({ screenshot: undefined }), env)
    expect(response.status).toBe(200)
    expect(env.FEATURE_REQUEST_SCREENSHOTS.objects.size).toBe(0)
    expect(String(calls[0].body.body)).not.toContain('## Screenshot')
  })

  test('rejects a screenshot over 5 MB before storing, counting or calling GitHub', async () => {
    const env = createEnv()
    const tooBig = `data:image/jpeg;base64,${'A'.repeat(7 * 1024 * 1024)}`
    const response = await post(validBody({ screenshot: tooBig }), env)
    expect(response.status).toBe(413)
    expect(env.FEATURE_REQUEST_SCREENSHOTS.objects.size).toBe(0)
    expect(env.SIGNALING_KV.values.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  test('still succeeds when WAHA is not configured', async () => {
    const response = await post(validBody(), createEnv({ WAHA_URL: undefined }))
    expect(response.status).toBe(200)
    expect((await response.json()).whatsAppSent).toBe(false)
    expect(calls).toHaveLength(1)
  })

  test('sends Cloudflare Access headers when a service token is set', async () => {
    await post(
      validBody(),
      createEnv({
        WAHA_ACCESS_CLIENT_ID: 'id.access',
        WAHA_ACCESS_CLIENT_SECRET: 'access-secret',
      })
    )
    expect(calls[1].headers['CF-Access-Client-Id']).toBe('id.access')
    expect(calls[1].headers['CF-Access-Client-Secret']).toBe('access-secret')
  })

  test('accepts a request without an email', async () => {
    for (const email of [undefined, '', '   ']) {
      calls = []
      const response = await post(validBody({ email }))
      expect(response.status).toBe(200)
      expect(String(calls[1].body.text)).toContain('*Email:* -')
    }
  })

  test('rejects an invalid email before calling GitHub', async () => {
    const response = await post(validBody({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  test('rejects a screenshot that is not JPEG, PNG or WebP', async () => {
    const response = await post(
      validBody({ screenshot: 'data:image/svg+xml;base64,PHN2Zy8+' })
    )
    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  test('returns 429 when the burst rate limit is hit', async () => {
    limiterAllows = false
    const response = await post(validBody())
    expect(response.status).toBe(429)
    expect((await response.json()).code).toBe('rate_limited')
    expect(calls).toHaveLength(0)
  })

  test('allows 50 requests per IP in 24 hours, then 429 before GitHub', async () => {
    const env = createEnv()
    for (let i = 0; i < 50; i++) {
      const response = await post(validBody({ screenshot: undefined }), env)
      expect(response.status).toBe(200)
    }
    const callsBefore = calls.length

    const response = await post(validBody(), env)
    expect(response.status).toBe(429)
    expect((await response.json()).code).toBe('rate_limited')
    expect(calls).toHaveLength(callsBefore)

    // Only a hashed IP is stored, never the raw one.
    const keys = [...env.SIGNALING_KV.values.keys()]
    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toContain(CLIENT_IP)
    expect(env.SIGNALING_KV.values.get(keys[0])).not.toContain(CLIENT_IP)
  })

  test('the 24-hour window rolls: requests older than a day stop counting', async () => {
    const env = createEnv()
    await post(validBody({ screenshot: undefined }), env)
    const [key] = [...env.SIGNALING_KV.values.keys()]
    const now = Date.now()
    const old = Array.from({ length: 49 }, () => now - DAY_MS - 1000)
    const recent = Array.from({ length: 49 }, () => now - 1000)
    env.SIGNALING_KV.values.set(key, JSON.stringify([...old, ...recent]))

    expect((await post(validBody({ screenshot: undefined }), env)).status).toBe(200)
    expect((await post(validBody({ screenshot: undefined }), env)).status).toBe(429)
  })

  test('invalid requests do not use up the daily quota', async () => {
    const env = createEnv()
    await post(validBody({ email: 'nope' }), env)
    expect(env.SIGNALING_KV.values.size).toBe(0)
  })

  test("returns 500 without GitHub's error details when GitHub fails", async () => {
    globalThis.fetch = (async () =>
      new Response('boom: token details', {
        status: 502,
      })) as unknown as typeof fetch
    const response = await post(validBody())
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('boom')
  })

  test('names the issue after the first line of the notes when no title is sent', async () => {
    const notes = `  \n${'Bigger   song font for the projector please '.repeat(3)}\nMore detail`
    const response = await post(validBody({ title: undefined, notes }))
    expect(response.status).toBe(200)
    const title = String(calls[0].body.title)
    expect(
      title.startsWith('Bigger song font for the projector please Bigger')
    ).toBe(true)
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title.endsWith('…')).toBe(true)
  })

  test('puts the notes on the screenshot in the issue as numbered text', async () => {
    const response = await post(
      validBody({
        title: undefined,
        notes: '',
        screenshotNotes: ['Make this  bigger', '', 'Move it here @someone'],
      })
    )
    expect(response.status).toBe(200)
    const [github, waha] = calls
    const issueBody = String(github.body.body)
    expect(issueBody).not.toContain('## Request')
    expect(issueBody).toContain(
      '## Notes on the screenshot\n\n1. Make this bigger\n2. Move it here @​someone'
    )
    // No description: the first note names the issue.
    expect(github.body.title).toBe('Make this bigger')
    expect(String(waha.body.text)).toContain('1. Make this bigger')
  })

  test('the description is optional when a screenshot is sent', async () => {
    const response = await post(validBody({ title: undefined, notes: '' }))
    expect(response.status).toBe(200)
    expect(calls[0].body.title).toBe('Request from the app')
  })

  test('rejects a request with no description, note or screenshot', async () => {
    const response = await post(
      validBody({ notes: '', screenshot: undefined, screenshotNotes: [] })
    )
    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  test('rejects screenshot notes that are not a short list of text', async () => {
    const tooMany = Array.from({ length: 31 }, (_, index) => `note ${index}`)
    expect((await post(validBody({ screenshotNotes: tooMany }))).status).toBe(400)
    expect((await post(validBody({ screenshotNotes: 'one' }))).status).toBe(400)
    expect((await post(validBody({ screenshotNotes: [42] }))).status).toBe(400)
    expect(
      (await post(validBody({ screenshotNotes: ['x'.repeat(301)] }))).status
    ).toBe(400)
    expect(calls).toHaveLength(0)
  })

  test('still accepts a title from older app versions', async () => {
    await post(validBody({ title: 'Old app title' }))
    expect(calls[0].body.title).toBe('Old app title')
  })

  test('rejects a body over 8 MB before reading it', async () => {
    const response = await app.request(
      'https://backend.test/feature-requests',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(9 * 1024 * 1024),
          'CF-Connecting-IP': CLIENT_IP,
        },
        body: '{}',
      },
      createEnv()
    )
    expect(response.status).toBe(413)
    expect(calls).toHaveLength(0)
  })

  test('keeps user text in the context from pinging GitHub users', async () => {
    await post(validBody({ route: '/songs/@octocat' }))
    expect(String(calls[0].body.body)).toContain('/songs/@​octocat')
  })
})
