import { randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { lanBaseUrl } from './helpers/lan-address'
import { rawRequest } from './helpers/raw-request'

/**
 * Which pages may call the server with the user's credentials. The app's own
 * origins (the desktop and phone webviews, pages on this machine, the server
 * as a browser reached it, origins a deployment adds) get CORS and may write;
 * any other origin gets no CORS headers and is refused, and so is a write a
 * page of another site could send without an origin (a form post). Sign-in
 * returns from Google still arrive as cross-site navigations.
 *
 * The default `request` fixture is the super admin (auth.setup.ts), so every
 * refused request below carries real credentials.
 */

const FOREIGN = 'https://foreign.example'
const WEBVIEWS = [
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]
const PROBE_KEY = 'e2e_origin_probe'

async function readProbe(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`/api/settings/app_settings/${PROBE_KEY}`)
  if (res.status() === 404) return null
  return ((await res.json()).data?.value as string | undefined) ?? null
}

function writeProbe(
  request: APIRequestContext,
  value: string,
  headers: Record<string, string> = {},
) {
  return request.post('/api/settings/app_settings', {
    headers,
    data: { key: PROBE_KEY, value },
  })
}

/** Opens /ws with a given Origin: 101 when upgraded, else the HTTP status. */
function openSocket(baseURL: string, origin: string): Promise<number> {
  const url = new URL('/ws', baseURL)
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        Origin: origin,
      },
    })
    req.on('upgrade', (_res, socket) => {
      socket.destroy()
      resolve(101)
    })
    req.on('response', (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}

test.describe('Request origins', () => {
  test.afterAll(async ({ request }) => {
    await request.delete(`/api/settings/app_settings/${PROBE_KEY}`)
    await request.delete('/api/settings/app_settings/trusted_origins')
  })

  test('a foreign origin gets no CORS headers and cannot read or write', async ({
    request,
  }) => {
    const read = await request.get('/api/auth/me', {
      headers: { Origin: FOREIGN },
    })
    expect(read.status()).toBe(403)
    expect(read.headers()['access-control-allow-origin']).toBeUndefined()

    const preflight = await request.fetch('/api/settings/app_settings', {
      method: 'OPTIONS',
      headers: {
        Origin: FOREIGN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect(preflight.status()).toBe(403)
    expect(preflight.headers()['access-control-allow-origin']).toBeUndefined()

    const before = await readProbe(request)
    const write = await writeProbe(request, 'foreign', { Origin: FOREIGN })
    expect(write.status()).toBe(403)
    expect(await readProbe(request)).toBe(before)

    for (const origin of ['null', 'http://localhost.foreign.example']) {
      const res = await request.get('/api/auth/me', {
        headers: { Origin: origin },
      })
      expect(res.status()).toBe(403)
    }
  })

  test("the app's own origins get CORS and can write", async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const port = new URL(base).port
    const origins = [base, `http://127.0.0.1:${port}`, ...WEBVIEWS]

    for (const origin of origins) {
      const read = await request.get('/api/auth/me', {
        headers: { Origin: origin },
      })
      expect(read.status(), origin).toBe(200)
      expect(read.headers()['access-control-allow-origin']).toBe(origin)
      expect(read.headers()['access-control-allow-credentials']).toBe('true')

      const preflight = await request.fetch('/api/settings/app_settings', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, x-user-auth',
        },
      })
      expect(preflight.status(), origin).toBe(204)
      expect(preflight.headers()['access-control-allow-origin']).toBe(origin)
      expect(preflight.headers()['access-control-allow-headers']).toContain(
        'X-User-Auth',
      )

      const write = await writeProbe(request, origin, { Origin: origin })
      expect(write.ok(), origin).toBe(true)
      expect(await readProbe(request)).toBe(origin)
    }

    // A browser on the church network that loaded the app from the server.
    const lan = lanBaseUrl()
    const fromLan = await rawRequest(lan, '/api/auth/local-users', {
      headers: { Origin: lan },
    })
    expect(fromLan.status).toBe(200)
    expect(fromLan.headers['access-control-allow-origin']).toBe(lan)

    // Clients that aren't browsers send no origin and keep working.
    const script = await writeProbe(request, 'script')
    expect(script.ok()).toBe(true)
  })

  test('an origin added in the trusted_origins setting is trusted', async ({
    request,
  }) => {
    const proxy = 'https://hub.church.example'
    expect(
      (
        await request.get('/api/auth/me', { headers: { Origin: proxy } })
      ).status(),
    ).toBe(403)

    const set = await request.post('/api/settings/app_settings', {
      data: {
        key: 'trusted_origins',
        value: `${proxy}, https://other.example`,
      },
    })
    expect(set.ok()).toBe(true)
    const read = await request.get('/api/auth/me', {
      headers: { Origin: proxy },
    })
    expect(read.status()).toBe(200)
    expect(read.headers()['access-control-allow-origin']).toBe(proxy)

    await request.delete('/api/settings/app_settings/trusted_origins')
    expect(
      (
        await request.get('/api/auth/me', { headers: { Origin: proxy } })
      ).status(),
    ).toBe(403)
  })

  test('a cross-site form post is refused', async ({ request }) => {
    const before = await readProbe(request)
    const formBody = `key=${PROBE_KEY}&value=form`
    const jsonBody = JSON.stringify({ key: PROBE_KEY, value: 'form' })

    // What a browser sends for another site's form.
    const crossSiteForm = await request.post('/api/settings/app_settings', {
      headers: {
        Origin: FOREIGN,
        'Sec-Fetch-Site': 'cross-site',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formBody,
    })
    expect(crossSiteForm.status()).toBe(403)

    // The same without an Origin (an old browser): marked cross-site, or a
    // text/plain form whose body reads as JSON.
    const markedCrossSite = await request.post('/api/settings/app_settings', {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
      data: { key: PROBE_KEY, value: 'form' },
    })
    expect(markedCrossSite.status()).toBe(403)
    for (const contentType of [
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data; boundary=x',
    ]) {
      const res = await request.post('/api/settings/app_settings', {
        headers: { 'Content-Type': contentType },
        data: jsonBody,
      })
      expect(res.status(), contentType).toBe(403)
    }
    expect(await readProbe(request)).toBe(before)

    // A header no other site's page can add lets a client through.
    const withAppHeader = await request.post('/api/settings/app_settings', {
      headers: { 'Content-Type': 'text/plain', 'X-Requested-With': 'script' },
      data: jsonBody,
    })
    expect(withAppHeader.ok()).toBe(true)
  })

  test('a website rebound to this machine gets no local access', async ({
    baseURL,
    request,
  }) => {
    const base = baseURL as string
    const rebound = `rebound.example:${new URL(base).port}`
    const headers = { Host: rebound, Origin: `http://${rebound}` }

    // Without a session this machine may read (projector windows)...
    expect((await rawRequest(base, '/api/songs')).status).toBe(200)
    // ...but not a page that came to it under another name.
    expect((await rawRequest(base, '/api/songs', { headers })).status).toBe(401)

    const users = (
      (await (await request.get('/api/auth/local-users')).json()) as {
        data: { id: number; isSuperAdmin: boolean }[]
      }
    ).data
    const superAdmin = users.find((u) => u.isSuperAdmin)
    const login = await rawRequest(base, '/api/auth/login', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: superAdmin?.id }),
    })
    expect(login.status).toBe(401)
    expect(JSON.parse(login.body).token).toBeUndefined()
  })

  test('the WebSocket opens only for trusted origins', async ({ baseURL }) => {
    const base = baseURL as string
    expect(await openSocket(base, FOREIGN)).toBe(403)
    expect(await openSocket(base, base)).toBe(101)
    expect(await openSocket(base, 'tauri://localhost')).toBe(101)
  })

  test('the Drive callback connects only the flow this server started', async ({
    request,
  }) => {
    const callback = '/api/backup/google/callback'
    const tokens = new URLSearchParams({
      accessToken: 'e2e-access',
      refreshToken: 'e2e-refresh',
      expiresAt: String(Date.now() + 3_600_000),
    })
    // Google's redirect arrives as a cross-site navigation.
    const navigation = {
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'navigate',
    }
    const isConnected = async () =>
      (await (await request.get('/api/backup/status')).json()).data
        .connected as boolean

    try {
      const planted = await request.get(`${callback}?${tokens}`, {
        headers: navigation,
      })
      expect(planted.status()).toBe(200)
      expect(await planted.text()).toContain('unknown_connect_flow')
      expect(await isConnected()).toBe(false)

      const connect = await request.get('/api/backup/google/connect')
      const authUrl = new URL((await connect.json()).data.authUrl as string)
      const returnUrl = new URL(authUrl.searchParams.get('returnUrl') as string)
      expect(returnUrl.pathname).toBe(callback)
      const state = returnUrl.searchParams.get('state') as string
      expect(state).toBeTruthy()

      const guessed = await request.get(
        `${callback}?state=not-${state}&${tokens}`,
        { headers: navigation },
      )
      expect(await guessed.text()).toContain('unknown_connect_flow')
      expect(await isConnected()).toBe(false)

      const own = await request.get(`${callback}?state=${state}&${tokens}`, {
        headers: navigation,
      })
      expect(own.status()).toBe(200)
      // (Status would now ask Google about these made-up tokens.)
      expect(await own.text()).toContain('Google Drive connected')

      // A state works once.
      const replayed = await request.get(
        `${callback}?state=${state}&${tokens}`,
        { headers: navigation },
      )
      expect(await replayed.text()).toContain('unknown_connect_flow')
    } finally {
      await request.post('/api/backup/google/disconnect')
    }
  })

  test('sign-in callback pages show what they were given as text', async ({
    request,
  }) => {
    const markup = '</script><script>window.__x=1</script>'
    const navigation = {
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-Mode': 'navigate',
    }

    const drive = await request.get(
      `/api/backup/google/callback?error=${encodeURIComponent(markup)}`,
      { headers: navigation },
    )
    expect(drive.status()).toBe(200)
    expect(await drive.text()).not.toContain('<script>window.__x')

    for (const param of ['error', 'code']) {
      const youtube = await request.get(
        `/api/livestream/youtube/callback?${param}=${encodeURIComponent(markup)}`,
        { headers: navigation },
      )
      expect(youtube.status()).toBe(200)
      expect(await youtube.text()).not.toContain('<script>window.__x')
    }

    // The owner sign-in's return, without a nonce this server issued.
    const owner = await request.get(
      '/api/sync/cloud/owner/callback?nonce=unknown&ticket=x&expiresAt=1',
      { headers: navigation },
    )
    expect(owner.status()).toBe(200)
    expect(await owner.text()).toContain('Sign-in failed')
  })
})
