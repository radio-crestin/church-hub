import { request as httpRequest } from 'node:http'
import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The server's auth guards, end to end over HTTP: who may read, who may write,
 * which credentials are refused and what the session cookie looks like.
 * Identity must come from credentials, never from the network location.
 *
 * The default `request` fixture is the super admin (auth.setup.ts). A "remote"
 * request is one whose Host header is not localhost, as a phone or another
 * computer on the church network would send; Node's http client lets the test
 * set that header (browser-style clients refuse to).
 */

const LAN_HOST = '192.168.50.10'

interface RawResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

/** A request with full control of its headers, Host included. */
function rawRequest(
  baseURL: string,
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string | Buffer
  } = {},
): Promise<RawResponse> {
  const url = new URL(path, baseURL)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        )
      },
    )
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

function remoteHeaders(baseURL: string, extra: Record<string, string> = {}) {
  return { Host: `${LAN_HOST}:${new URL(baseURL).port}`, ...extra }
}

async function createUser(
  request: APIRequestContext,
  permissions: string[],
  password: string,
): Promise<number> {
  const res = await request.post('/api/users', {
    data: {
      name: `E2E Guard ${Date.now()}-${Math.random()}`,
      permissions,
      password,
    },
  })
  expect([200, 201]).toContain(res.status())
  return (await res.json()).data.user.id as number
}

/** Signs a user in and returns the raw `user_auth` token from the cookie. */
async function loginToken(
  baseURL: string,
  userId: number,
  password: string,
): Promise<string> {
  const res = await rawRequest(baseURL, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  })
  expect(res.status).toBe(200)
  const cookie = [res.headers['set-cookie'] ?? []].flat().join('\n')
  const token = cookie.match(/user_auth=([^;]+)/)?.[1]
  expect(token, 'login sets a user_auth cookie').toBeTruthy()
  return token as string
}

const PASSWORD = 'e2e-guard-123'

test.describe('API auth guards', () => {
  test('a remote request without credentials is refused', async ({
    baseURL,
  }) => {
    const base = baseURL as string
    for (const path of ['/api/songs', '/api/settings/app_settings']) {
      const res = await rawRequest(base, path, { headers: remoteHeaders(base) })
      expect(res.status, path).toBe(401)
    }
    // The "Request a feature" relay never reaches the worker anonymously.
    const feature = await rawRequest(base, '/api/feature-requests', {
      method: 'POST',
      headers: remoteHeaders(base, { 'Content-Type': 'application/json' }),
      body: '{}',
    })
    expect(feature.status).toBe(401)
  })

  test('forged or unknown credentials are refused', async ({ baseURL }) => {
    const base = baseURL as string
    const forged: Record<string, string>[] = [
      { Authorization: 'Bearer not-a-real-system-token' },
      { Cookie: 'user_auth=not-a-real-user-token' },
      { 'X-User-Auth': 'not-a-real-user-token' },
    ]
    for (const credentials of forged) {
      const res = await rawRequest(base, '/api/songs', {
        headers: remoteHeaders(base, credentials),
      })
      expect(res.status, JSON.stringify(Object.keys(credentials))).toBe(401)
    }
  })

  test('a cookie-less local request may read but never write or administer', async ({
    baseURL,
  }) => {
    const base = baseURL as string
    // Projector windows read presentation state without a session.
    const read = await rawRequest(base, '/api/songs')
    expect(read.status).toBe(200)

    const write = await rawRequest(base, '/api/settings/app_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'e2e-guard', value: 'x' }),
    })
    expect(write.status).toBe(403)

    const admin = await rawRequest(base, '/api/users')
    expect(admin.status).toBe(403)
  })

  test('a deactivated user loses access at once', async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const userId = await createUser(request, ['songs.view'], PASSWORD)
    const token = await loginToken(base, userId, PASSWORD)

    const before = await rawRequest(base, '/api/songs', {
      headers: remoteHeaders(base, { Cookie: `user_auth=${token}` }),
    })
    expect(before.status).toBe(200)

    const deactivate = await request.put(`/api/users/${userId}`, {
      data: { isActive: false },
    })
    expect(deactivate.ok()).toBe(true)

    const after = await rawRequest(base, '/api/songs', {
      headers: remoteHeaders(base, { Cookie: `user_auth=${token}` }),
    })
    expect(after.status).toBe(401)
  })

  test('a signed-in user who is not an admin cannot administer', async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const userId = await createUser(
      request,
      ['songs.view', 'users.view', 'settings.view'],
      PASSWORD,
    )
    const token = await loginToken(base, userId, PASSWORD)
    const res = await rawRequest(base, `/api/users/${userId}`, {
      method: 'PUT',
      headers: remoteHeaders(base, {
        Cookie: `user_auth=${token}`,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ isActive: true }),
    })
    expect(res.status).toBe(403)
  })

  test('"any of" permissions: appearance-only users change only the theme', async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const userId = await createUser(
      request,
      ['settings.view', 'settings.edit_appearance'],
      PASSWORD,
    )
    const token = await loginToken(base, userId, PASSWORD)
    const post = (key: string, value: string) =>
      rawRequest(base, '/api/settings/app_settings', {
        method: 'POST',
        headers: {
          Cookie: `user_auth=${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      })

    const previous = await request.get('/api/settings/app_settings/theme')
    const previousTheme = previous.ok()
      ? ((await previous.json()).data?.value as string | undefined)
      : undefined
    try {
      expect((await post('theme', 'dark')).status).toBe(200)
      expect((await post('e2e-guard-other', 'x')).status).toBe(403)
    } finally {
      // The test database is shared by the whole suite: leave the theme as found.
      if (previousTheme) {
        await request.post('/api/settings/app_settings', {
          data: { key: 'theme', value: previousTheme },
        })
      } else {
        await request.delete('/api/settings/app_settings/theme')
      }
    }
  })

  test('background media: writes need displays.edit, reads need a session', async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const viewerId = await createUser(request, ['displays.view'], PASSWORD)
    const token = await loginToken(base, viewerId, PASSWORD)
    const asViewer = (extra: Record<string, string> = {}) => ({
      Cookie: `user_auth=${token}`,
      ...extra,
    })

    const upload = await rawRequest(base, '/api/media/backgrounds', {
      method: 'POST',
      headers: asViewer({ 'Content-Type': 'image/png' }),
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    })
    expect(upload.status).toBe(403)

    const remoteList = await rawRequest(base, '/api/media/backgrounds', {
      headers: remoteHeaders(base),
    })
    expect(remoteList.status).toBe(401)

    // A path-traversal id is refused before any file is touched.
    const traversal = await rawRequest(
      base,
      '/api/media/backgrounds/..%2Fapp.db',
      { headers: asViewer() },
    )
    expect(traversal.status).toBe(400)
  })

  test('song history: an entry of another song cannot be restored', async ({
    request,
  }) => {
    // The test database is shared by the whole suite: a song left behind
    // (this run's or an earlier one's) would turn up in other specs' searches.
    const SONG_PREFIX = 'Guard restore song'
    const leftovers = (await (
      await request.get(
        `/api/songs/search?q=${encodeURIComponent(SONG_PREFIX)}`,
      )
    ).json()) as { data: { id: number; title: string }[] }
    for (const song of leftovers.data) {
      if (song.title.startsWith(SONG_PREFIX))
        await request.delete(`/api/songs/${song.id}`)
    }

    const create = async (title: string) => {
      const res = await request.post('/api/songs', {
        data: {
          title,
          slides: [{ content: `${title} verse`, sortOrder: 0, label: 'V1' }],
        },
      })
      expect(res.ok()).toBe(true)
      return (await res.json()).data.id as number
    }
    const songA = await create(`${SONG_PREFIX} A`)
    const songB = await create(`${SONG_PREFIX} B`)
    try {
      const historyOfA = (await (
        await request.get(`/api/songs/${songA}/history`)
      ).json()) as { data: { id: number }[] }
      const entryOfA = historyOfA.data[0]!.id

      const res = await request.post(
        `/api/songs/${songB}/history/${entryOfA}/restore`,
        { data: { side: 'after' } },
      )
      expect(res.ok()).toBe(false)
      const songBAfter = (
        await (await request.get(`/api/songs/${songB}`)).json()
      ).data as { title: string }
      expect(songBAfter.title).toBe(`${SONG_PREFIX} B`)
    } finally {
      await request.delete(`/api/songs/${songA}`)
      await request.delete(`/api/songs/${songB}`)
    }
  })

  test('the session cookie is HttpOnly and fits the engine and host', async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const userId = await createUser(request, ['songs.view'], PASSWORD)
    const login = (headers: Record<string, string>) =>
      rawRequest(base, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ userId, password: PASSWORD }),
      })
    const cookieOf = (res: RawResponse) =>
      [res.headers['set-cookie'] ?? []].flat().join('\n')

    const chromium = cookieOf(
      await login({
        'User-Agent':
          'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      }),
    )
    expect(chromium).toContain('HttpOnly')
    expect(chromium).toContain('SameSite=None')
    expect(chromium).toContain('Secure')

    const webkit = cookieOf(
      await login({
        'User-Agent':
          'Mozilla/5.0 AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      }),
    )
    expect(webkit).toContain('HttpOnly')
    expect(webkit).toContain('SameSite=Lax')
    expect(webkit).not.toContain('Secure')

    const lan = cookieOf(await login(remoteHeaders(base)))
    expect(lan).toContain('HttpOnly')
    expect(lan).toContain('SameSite=Lax')
    expect(lan).toContain(`Domain=${LAN_HOST}`)
  })
})
