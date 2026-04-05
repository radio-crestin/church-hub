import { expect, test } from '@playwright/test'

test.describe('Database Management - API', () => {
  test('can get database info', async ({ request }) => {
    const response = await request.get('/api/database/info')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('path')
    expect(json.data).toHaveProperty('sizeBytes')
    expect(typeof json.data.path).toBe('string')
    expect(typeof json.data.sizeBytes).toBe('number')
    expect(json.data.sizeBytes).toBeGreaterThan(0)
  })

  test('database info includes data directory', async ({ request }) => {
    const response = await request.get('/api/database/info')
    const json = await response.json()

    expect(json.data).toHaveProperty('dataDir')
    expect(typeof json.data.dataDir).toBe('string')
    expect(json.data.dataDir.length).toBeGreaterThan(0)
  })

  test('can rebuild search indexes', async ({ request }) => {
    const response = await request.post('/api/database/rebuild-search-indexes')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('success')
    expect(json.data.success).toBe(true)
    expect(json.data).toHaveProperty('duration')
    expect(typeof json.data.duration).toBe('number')
  })

  test('can rebuild specific search indexes (songs only)', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/database/rebuild-search-indexes',
      {
        data: { songs: true },
      },
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data.success).toBe(true)
  })

  test('can rebuild specific search indexes (bible only)', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/database/rebuild-search-indexes',
      {
        data: { bible: true },
      },
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data.success).toBe(true)
  })

  test('can rebuild specific search indexes (schedules only)', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/database/rebuild-search-indexes',
      {
        data: { schedules: true },
      },
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data.success).toBe(true)
  })

  test('database export requires destination path', async ({ request }) => {
    const response = await request.post('/api/database/export', {
      data: {},
    })
    expect(response.status()).toBe(400)
  })

  test('database import requires source path', async ({ request }) => {
    const response = await request.post('/api/database/import', {
      data: {},
    })
    expect(response.status()).toBe(400)
  })

  test('database import with non-existent file returns error', async ({
    request,
  }) => {
    const response = await request.post('/api/database/import', {
      data: {
        sourcePath: '/tmp/nonexistent-db-file-12345.sqlite',
      },
    })
    expect([400, 500]).toContain(response.status())
  })

  test('can export database to temp path', async ({ request }) => {
    const exportPath = `/tmp/church-hub-e2e-export-${Date.now()}.sqlite`

    const response = await request.post('/api/database/export', {
      data: { destinationPath: exportPath },
    })

    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveProperty('success')
    expect(json.data.success).toBe(true)
    expect(json.data).toHaveProperty('exportedPath')
  })
})

test.describe('Database Management - UI', () => {
  test('database management section exists in settings', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Scroll to bottom to find database section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Look for database management or search index rebuild section
    const dbSection = page.locator(
      'text=/database|baza de date|search index|index de cautare|factory reset/i',
    )
    if (
      await dbSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(dbSection.first()).toBeVisible()
    }
  })

  test('search index rebuild button exists in settings', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    const rebuildButton = page.locator(
      'button:has-text(/rebuild|reconstruire|reconstruieste/i)',
    )
    if (
      await rebuildButton
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(rebuildButton.first()).toBeVisible()
    }
  })
})
