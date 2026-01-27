import { describe, expect, test } from 'bun:test'

const BASE_URL = 'http://localhost:3000'

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
    // Response has { data: [...] } structure
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
