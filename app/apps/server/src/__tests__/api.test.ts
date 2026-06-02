import { resolve } from 'path'
import { type Subprocess, spawn } from 'bun'

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from 'bun:test'

setDefaultTimeout(120_000)

const TEST_PORT = 3099
// 127.0.0.1 — "localhost" resolves to ::1 first on Bun + recent Linux,
// but Bun.serve binds 0.0.0.0 (IPv4 only), making fetch hang.
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

let serverProcess: Subprocess | null = null

// Session cookie for an authenticated Super Admin. The permissions model makes
// cookie-less localhost read-only, so mutating requests must carry a session.
let authCookie = ''

// fetch wrapper that attaches the authenticated session cookie. Reads work
// without it; writes (create/update/delete, presentation control) require it.
function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      Cookie: authCookie,
    },
  })
}

async function waitForServer(url: string, maxAttempts = 360): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    // Per-attempt AbortController — without it, a Bun fetch that opens
    // the TCP connection but never gets a response (seen in Bun 1.3.14
    // on Linux CI before the server bound) hangs forever and silently
    // burns the entire beforeAll budget instead of retrying.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    try {
      await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      return
    } catch {
      clearTimeout(timeoutId)
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`Server did not start within ${maxAttempts * 500}ms`)
}

beforeAll(async () => {
  const serverEntry = resolve(import.meta.dir, '..', 'index.ts')
  serverProcess = spawn({
    cmd: ['bun', 'run', serverEntry],
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  // Pump stdout/stderr to console so a failing spawn is debuggable
  void (async () => {
    const r = serverProcess!.stdout.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { value, done } = await r.read()
      if (done) break
      process.stderr.write(`[srv-out] ${dec.decode(value)}`)
    }
  })()
  void (async () => {
    const r = serverProcess!.stderr.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { value, done } = await r.read()
      if (done) break
      process.stderr.write(`[srv-err] ${dec.decode(value)}`)
    }
  })()
  await waitForServer(`${BASE_URL}/api/database/info`)

  // Log in as the bootstrapped passwordless Super Admin (frictionless on
  // localhost) and reuse the session cookie for write operations below.
  const usersRes = await fetch(`${BASE_URL}/api/auth/local-users`)
  const usersJson = (await usersRes.json()) as {
    data: { id: number; isSuperAdmin: boolean; hasPassword: boolean }[]
  }
  const admin =
    usersJson.data.find((u) => u.isSuperAdmin && !u.hasPassword) ??
    usersJson.data.find((u) => u.isSuperAdmin)
  if (!admin) {
    throw new Error('No passwordless Super Admin available for tests')
  }
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: admin.id }),
  })
  if (!loginRes.ok) {
    throw new Error(`Test login failed (${loginRes.status})`)
  }
  authCookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  if (!authCookie) {
    throw new Error('Login did not set a session cookie')
  }
}, 240_000)

afterAll(() => {
  serverProcess?.kill()
})

describe('API Health', () => {
  test('GET /api/database/info returns 200', async () => {
    const res = await fetch(`${BASE_URL}/api/database/info`)
    expect(res.status).toBe(200)
  })

  test('GET /api/docs returns 200', async () => {
    const res = await fetch(`${BASE_URL}/api/docs`)
    expect(res.status).toBe(200)
  })

  test('GET /api/openapi.json returns 200', async () => {
    const res = await fetch(`${BASE_URL}/api/openapi.json`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('openapi')
  })
})

describe('Songs API', () => {
  test('GET /api/songs returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/songs`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/songs/search returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/songs/search?q=test`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/songs with sortBy returns paginated results', async () => {
    for (const sortBy of [
      'lastPlayed',
      'mostPlayed',
      'title',
      'newest',
      'oldest',
    ]) {
      const res = await fetch(
        `${BASE_URL}/api/songs?limit=5&offset=0&sortBy=${sortBy}`,
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data).toHaveProperty('songs')
      expect(Array.isArray(json.data.songs)).toBe(true)
    }
  })

  test('GET /api/categories returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/categories`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })
})

describe('Schedules API', () => {
  test('GET /api/schedules returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/schedules`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/schedules/search returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/schedules/search?q=test`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('adding a song to a schedule returns the item with song data', async () => {
    // Create a test song - use long unique words to avoid sanitized-title collisions
    const testTitle = `Zymologica Quixotique ${Date.now()}`
    const songRes = await authedFetch(`${BASE_URL}/api/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: testTitle,
        slides: [{ content: '<p>Verse 1</p>', sortOrder: 0 }],
      }),
    })
    expect(songRes.ok).toBe(true)
    const songJson = await songRes.json()
    const songId = songJson.data.id

    // Create a test schedule
    const scheduleRes = await authedFetch(`${BASE_URL}/api/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `__test_schedule_${Date.now()}__` }),
    })
    expect(scheduleRes.ok).toBe(true)
    const scheduleJson = await scheduleRes.json()
    const scheduleId = scheduleJson.data.id

    try {
      // Add song to schedule
      const addRes = await authedFetch(
        `${BASE_URL}/api/schedules/${scheduleId}/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId }),
        },
      )
      expect(addRes.status).toBe(201)
      const addJson = await addRes.json()
      expect(addJson).toHaveProperty('data')
      expect(addJson.data.itemType).toBe('song')
      expect(addJson.data.songId).toBe(songId)

      // Verify the item appears when fetching the schedule
      const getRes = await fetch(`${BASE_URL}/api/schedules/${scheduleId}`)
      expect(getRes.ok).toBe(true)
      const getJson = await getRes.json()
      expect(getJson.data.items.length).toBe(1)
      expect(getJson.data.items[0].itemType).toBe('song')
      expect(getJson.data.items[0].songId).toBe(songId)
    } finally {
      await authedFetch(`${BASE_URL}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })
      await authedFetch(`${BASE_URL}/api/songs/${songId}`, { method: 'DELETE' })
    }
  })

  test('adding multiple songs (bookmarks) to a schedule works', async () => {
    // Create test songs with completely unique titles
    const songIds: number[] = []
    const ts = Date.now()
    const uniqueTitles = [
      `Xyloquintar Primavox ${ts}`,
      `Quasifonico Betavolt ${ts}`,
      `Chronexial Gammaflex ${ts}`,
    ]
    for (const title of uniqueTitles) {
      const res = await authedFetch(`${BASE_URL}/api/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slides: [{ content: '<p>Test</p>', sortOrder: 0 }],
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(
          `Song creation failed (${res.status}): ${JSON.stringify(json)}`,
        )
      }
      songIds.push(json.data.id)
    }

    // Create a test schedule
    const scheduleRes = await authedFetch(`${BASE_URL}/api/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `__test_bookmarks_schedule_${Date.now()}__`,
      }),
    })
    expect(scheduleRes.ok).toBe(true)
    const scheduleId = scheduleRes.json().then((j: any) => j.data.id)
    const sid = await scheduleId

    try {
      // Add each song (simulating bookmark batch add)
      for (const songId of songIds) {
        const addRes = await authedFetch(
          `${BASE_URL}/api/schedules/${sid}/items`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId }),
          },
        )
        expect(addRes.status).toBe(201)
      }

      // Verify all items appear
      const getRes = await fetch(`${BASE_URL}/api/schedules/${sid}`)
      expect(getRes.ok).toBe(true)
      const getJson = await getRes.json()
      expect(getJson.data.items.length).toBe(3)

      // Verify correct sort order
      for (let i = 0; i < 3; i++) {
        expect(getJson.data.items[i].songId).toBe(songIds[i])
        expect(getJson.data.items[i].sortOrder).toBe(i)
      }
    } finally {
      await authedFetch(`${BASE_URL}/api/schedules/${sid}`, {
        method: 'DELETE',
      })
      for (const songId of songIds) {
        await authedFetch(`${BASE_URL}/api/songs/${songId}`, {
          method: 'DELETE',
        })
      }
    }
  })
})

describe('Bible API', () => {
  test('GET /api/bible/translations returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/bible/translations`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })
})

describe('Music Player API', () => {
  test('GET /api/music/player/status returns 200 with status', async () => {
    const res = await fetch(`${BASE_URL}/api/music/player/status`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('installed')
    expect(json.data).toHaveProperty('available')
    expect(typeof json.data.installed).toBe('boolean')
    expect(typeof json.data.available).toBe('boolean')
  })

  test('GET /api/music/folders returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/music/folders`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/music/files returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/music/files`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/music/playlists returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/music/playlists`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('WebSocket receives music_state after music_get_state request', async () => {
    const ws = new WebSocket(`${BASE_URL.replace('http', 'ws')}/ws`)

    const result = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000)

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'music_get_state' }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(
            typeof event.data === 'string'
              ? event.data
              : new TextDecoder().decode(event.data as ArrayBuffer),
          )
          if (data.type === 'music_state') {
            clearTimeout(timeout)
            expect(data.payload).toHaveProperty('isPlaying')
            expect(data.payload).toHaveProperty('volume')
            expect(data.payload).toHaveProperty('currentIndex')
            expect(data.payload).toHaveProperty('queue')
            expect(data.payload).toHaveProperty('updatedAt')
            resolve(true)
          }
        } catch {
          // Ignore parse errors for non-JSON messages
        }
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        resolve(false)
      }
    })

    ws.close()
    expect(result).toBe(true)
  })
})

describe('Presentation API', () => {
  test('GET /api/presentation/state returns 200', async () => {
    const res = await fetch(`${BASE_URL}/api/presentation/state`)
    expect(res.status).toBe(200)
  })

  test('GET /api/screens returns 200 with data array', async () => {
    const res = await fetch(`${BASE_URL}/api/screens`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('clearing temporary content sets isHidden to true', async () => {
    // First, create a song to present (use timestamp for unique title)
    const testTitle = `Phenoluxar Zetaprism ${Date.now()}`
    const createRes = await authedFetch(`${BASE_URL}/api/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: testTitle,
        slides: [{ content: '<p>Test slide</p>', sortOrder: 0 }],
      }),
    })
    expect(createRes.ok).toBe(true)
    const createJson = await createRes.json()
    const songId = createJson.data.id

    try {
      // Present the song as temporary content
      const presentRes = await authedFetch(
        `${BASE_URL}/api/presentation/temporary-song`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, slideIndex: 0 }),
        },
      )
      expect(presentRes.status).toBe(200)
      const presentJson = await presentRes.json()
      expect(presentJson.data.isHidden).toBe(false)
      expect(presentJson.data.temporaryContent).not.toBeNull()

      // Clear temporary content (this is what ESC triggers)
      const clearRes = await authedFetch(
        `${BASE_URL}/api/presentation/clear-temporary`,
        { method: 'POST' },
      )
      expect(clearRes.status).toBe(200)
      const clearJson = await clearRes.json()

      // isHidden must be true so the exit animation triggers cleanly
      // (prevents the hide/show/hide flicker bug)
      expect(clearJson.data.isHidden).toBe(true)
      expect(clearJson.data.temporaryContent).toBeNull()

      // Verify state is persisted correctly
      const stateRes = await fetch(`${BASE_URL}/api/presentation/state`)
      const stateJson = await stateRes.json()
      expect(stateJson.data.isHidden).toBe(true)
      expect(stateJson.data.temporaryContent).toBeNull()
    } finally {
      // Clean up: delete the test song
      await authedFetch(`${BASE_URL}/api/songs/${songId}`, { method: 'DELETE' })
    }
  })
})
