import { expect, test } from '@playwright/test'

test.describe('Screen Editor - API', () => {
  let testScreenId: number | null = null

  test.afterAll(async ({ request }) => {
    // Clean up any test screen created during tests
    if (testScreenId) {
      await request.delete(`/api/screens/${testScreenId}`)
    }
  })

  test('can list all screens', async ({ request }) => {
    const response = await request.get('/api/screens')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can create a new screen', async ({ request }) => {
    const response = await request.post('/api/screens', {
      data: {
        name: `E2E Test Screen ${Date.now()}`,
        type: 'primary',
      },
    })

    expect([200, 201]).toContain(response.status())
    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('name')

    testScreenId = json.data.id
  })

  test('can get screen by ID with configs', async ({ request }) => {
    // First get the list to find an existing screen
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No screens available')
      return
    }

    const screenId = listJson.data[0].id
    const response = await request.get(`/api/screens/${screenId}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('name')
  })

  test('can update screen content config', async ({ request }) => {
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No screens available')
      return
    }

    const screenId = listJson.data[0].id

    const response = await request.put(`/api/screens/${screenId}/config/song`, {
      data: {
        config: {
          fontSize: 48,
          fontFamily: 'Arial',
          textAlign: 'center',
        },
      },
    })

    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('can update next slide config', async ({ request }) => {
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No screens available')
      return
    }

    const screenId = listJson.data[0].id

    const response = await request.put(
      `/api/screens/${screenId}/next-slide-config`,
      {
        data: {
          config: {
            enabled: true,
            position: 'bottom',
            heightPercent: 20,
          },
        },
      },
    )

    expect(response.status()).toBe(200)
  })

  test('can update global screen settings', async ({ request }) => {
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No screens available')
      return
    }

    const screenId = listJson.data[0].id

    const response = await request.put(
      `/api/screens/${screenId}/global-settings`,
      {
        data: {
          settings: {
            defaultBackground: '#000000',
          },
        },
      },
    )

    expect(response.status()).toBe(200)
  })

  test('can delete a screen', async ({ request }) => {
    // Create a screen to delete
    const createResponse = await request.post('/api/screens', {
      data: {
        name: `E2E Delete Screen ${Date.now()}`,
        type: 'primary',
      },
    })

    if (![200, 201].includes(createResponse.status())) {
      test.skip(true, 'Cannot create screen')
      return
    }

    const { data: created } = await createResponse.json()

    const deleteResponse = await request.delete(`/api/screens/${created.id}`)
    expect(deleteResponse.status()).toBe(200)

    // Verify deleted
    const getResponse = await request.get(`/api/screens/${created.id}`)
    expect(getResponse.status()).toBe(404)
  })

  test('getting non-existent screen returns 404', async ({ request }) => {
    const response = await request.get('/api/screens/999999')
    expect(response.status()).toBe(404)
  })
})

test.describe('Screen Renderer Page', () => {
  test('screen page renders for valid screen ID', async ({ page, request }) => {
    // Get a screen ID from the API
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No screens available')
      return
    }

    const screenId = listJson.data[0].id
    await page.goto(`/screen/${screenId}`)
    await page.waitForLoadState('networkidle')

    // Screen page should render (black background typically)
    await expect(page.locator('body')).toBeVisible()
  })

  test('invalid screen ID shows error message', async ({ page }) => {
    await page.goto('/screen/invalid')
    await page.waitForLoadState('networkidle')

    // Should show invalid screen ID message
    const errorText = page.locator('text=/invalid screen/i')
    await expect(errorText).toBeVisible({ timeout: 5000 })
  })

  test('screen page with negative ID shows error', async ({ page }) => {
    await page.goto('/screen/-1')
    await page.waitForLoadState('networkidle')

    const errorText = page.locator('text=/invalid screen/i')
    await expect(errorText).toBeVisible({ timeout: 5000 })
  })
})
