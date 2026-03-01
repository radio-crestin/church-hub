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

setDefaultTimeout(30_000)

const TEST_PORT = 3099
const BASE_URL = `http://localhost:${TEST_PORT}`

let serverProcess: Subprocess | null = null

async function waitForServer(url: string, maxAttempts = 40): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fetch(url)
      return
    } catch {
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
    stdout: 'ignore',
    stderr: 'ignore',
  })
  await waitForServer(`${BASE_URL}/api/database/info`)
})

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
    for (const sortBy of ['lastPlayed', 'mostPlayed', 'title', 'newest', 'oldest']) {
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
      const timeout = setTimeout(() => resolve(false), 10000)

      ws.onopen = () => {
        // Give server time to fully initialize music handler
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'music_get_state' }))
        }, 1000)
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
})
