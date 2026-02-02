import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { spawn, type Subprocess } from 'bun'
import { resolve } from 'path'

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
