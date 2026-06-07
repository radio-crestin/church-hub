import { expect, test } from '@playwright/test'

/**
 * ChromaDB search experiment: engine toggle, chroma status, dispatching and
 * benchmark. SQLite stays the default engine — tests that exercise a Chroma
 * engine skip gracefully when the Chroma sync isn't ready (first sync of a
 * large library takes minutes; CI may run without it).
 */
test.describe('Search Engine API', () => {
  test.afterEach(async ({ request }) => {
    // Always restore the default engine so other specs are unaffected.
    await request.put('/api/search/engine', { data: { engine: 'sqlite' } })
  })

  test('GET /api/search/engine returns configuration and chroma status', async ({
    request,
  }) => {
    const response = await request.get('/api/search/engine')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('configured')
    expect(json.data).toHaveProperty('effective')
    expect(json.data).toHaveProperty('fallback')
    expect(json.data.chroma).toHaveProperty('state')
    expect(json.data.chroma).toHaveProperty('counts')
  })

  test('PUT /api/search/engine rejects invalid engines', async ({
    request,
  }) => {
    const response = await request.put('/api/search/engine', {
      data: { engine: 'not-a-real-engine' },
    })
    expect(response.status()).toBe(400)
  })

  test('PUT /api/search/engine persists a valid engine', async ({
    request,
  }) => {
    const put = await request.put('/api/search/engine', {
      data: { engine: 'chroma-keyword' },
    })
    expect(put.status()).toBe(200)

    const get = await request.get('/api/search/engine')
    const json = await get.json()
    expect(json.data.configured).toBe('chroma-keyword')
  })

  test('GET /api/search/chroma-status reports a known state', async ({
    request,
  }) => {
    const response = await request.get('/api/search/chroma-status')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect([
      'disabled',
      'stopped',
      'starting',
      'syncing',
      'ready',
      'error',
    ]).toContain(json.data.state)
  })

  test('songs search reports the engine that served it', async ({
    request,
  }) => {
    const response = await request.get('/api/songs/search?q=a')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json).toHaveProperty('engine')
  })

  test('chroma engine serves songs search when ready, falls back otherwise', async ({
    request,
  }) => {
    await request.put('/api/search/engine', {
      data: { engine: 'chroma-keyword' },
    })

    const statusJson = await (
      await request.get('/api/search/chroma-status')
    ).json()
    const chromaReady = ['ready', 'syncing'].includes(statusJson.data.state)

    const response = await request.get('/api/songs/search?q=domnul')
    expect(response.status()).toBe(200)
    const json = await response.json()

    if (chromaReady) {
      expect(json.engine).toBe('chroma-keyword')
    } else {
      // Not ready — must fall back to sqlite instead of failing
      expect(json.engine).toBe('sqlite')
    }
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('bible reference search stays on sqlite path under chroma engine', async ({
    request,
  }) => {
    await request.put('/api/search/engine', {
      data: { engine: 'chroma-keyword' },
    })

    const response = await request.get(
      `/api/bible/search?q=${encodeURIComponent('Gen 1:1')}`,
    )
    expect(response.status()).toBe(200)
    const json = await response.json()
    // Reference parsing is engine-independent
    if (json.data.results.length > 0) {
      expect(json.data.type).toBe('reference')
    }
  })

  test('POST /api/search/benchmark compares engines', async ({ request }) => {
    test.slow()
    const response = await request.post('/api/search/benchmark', {
      data: { domain: 'songs', queries: ['Isus'], iterations: 2 },
    })
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data.domain).toBe('songs')
    const engines = json.data.engines.map((e: { engine: string }) => e.engine)
    expect(engines).toContain('sqlite')
    expect(engines).toContain('chroma-keyword')
    expect(engines).toContain('chroma-semantic')

    const sqlite = json.data.engines.find(
      (e: { engine: string }) => e.engine === 'sqlite',
    )
    expect(sqlite.available).toBe(true)
    expect(sqlite.queries.length).toBe(1)
  })
})

test.describe('Search Engine Settings UI', () => {
  test('settings page shows engine selector and chroma status', async ({
    page,
  }) => {
    await page.goto('/settings/search-engine')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByTestId('search-engine-select').locator('..'),
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('chroma-status-card')).toBeVisible()
    await expect(page.getByTestId('chroma-state-badge')).toBeVisible()
  })
})
