import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import app from '../src/index'

/**
 * Drives POST /feature-requests through the real Hono app with GitHub and
 * WAHA replaced by a fetch stub, an in-memory R2 bucket and a rate limiter
 * stub. Run with `bun test` from churchhub-backend/.
 */
const EMAIL = 'pastor@example.com'
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
    WAHA_URL: 'https://waha.test/',
    WAHA_API_KEY: 'test-waha-key',
    WAHA_CHAT_ID: '40700000000@c.us',
    FEATURE_REQUEST_SCREENSHOTS: createBucket(),
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
    ...overrides,
  }
}

function post(body: unknown, env = createEnv()) {
  return app.request(
    'https://backend.test/feature-requests',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    expect(waha.url).toBe('https://waha.test/api/sendText')
    expect(waha.headers['X-Api-Key']).toBe('test-waha-key')
    expect(waha.body.session).toBe('default')
    expect(waha.body.chatId).toBe('40700000000@c.us')
    const text = String(waha.body.text)
    expect(text).toContain('Bigger song font')
    expect(text).toContain(EMAIL)
    expect(text).toContain('Please let me pick the font size.')
    expect(text).toContain('issues/42')

    expect(env.FEATURE_REQUEST_SCREENSHOTS.objects.size).toBe(1)
  })

  test('serves the stored screenshot for the issue', async () => {
    const env = createEnv()
    await post(validBody(), env)
    const issueBody = String(calls[0].body.body)
    const screenshotUrl = /\((https:\/\/backend\.test[^)]+)\)/.exec(issueBody)?.[1]

    const response = await app.request(screenshotUrl as string, {}, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
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

  test('rejects a missing or invalid email before calling GitHub', async () => {
    const response = await post(validBody({ email: 'not-an-email' }))
    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  test('rejects a non-image screenshot', async () => {
    const response = await post(
      validBody({ screenshot: 'data:text/html;base64,PGgxPg==' })
    )
    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })

  test('returns 429 when the rate limit is hit', async () => {
    limiterAllows = false
    const response = await post(validBody())
    expect(response.status).toBe(429)
    expect(calls).toHaveLength(0)
  })

  test('returns 500 when GitHub fails', async () => {
    globalThis.fetch = (async () =>
      new Response('boom', { status: 502 })) as unknown as typeof fetch
    const response = await post(validBody())
    expect(response.status).toBe(500)
  })
})
