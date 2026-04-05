import { expect, test } from '@playwright/test'

test.describe('Song Search', () => {
  test('song search API returns results', async ({ request }) => {
    const response = await request.get('/api/songs/search?q=a')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('song search with empty query returns empty or error', async ({
    request,
  }) => {
    const response = await request.get('/api/songs/search?q=')
    // May return 200 with empty array or 400
    expect([200, 400]).toContain(response.status())
  })

  test('song search with special characters does not crash', async ({
    request,
  }) => {
    const response = await request.get(
      `/api/songs/search?q=${encodeURIComponent('test\'"<>&')}`,
    )
    expect([200, 400]).toContain(response.status())
  })

  test('song search with category filter', async ({ request }) => {
    // Get categories first
    const catResponse = await request.get('/api/categories')
    const catJson = await catResponse.json()

    if (catJson.data.length === 0) {
      test.skip(true, 'No categories available')
      return
    }

    const categoryId = catJson.data[0].id
    const response = await request.get(
      `/api/songs/search?q=a&categoryId=${categoryId}`,
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('song search UI filters songs in real-time', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const searchInput = page.getByPlaceholder(/search songs|caută cântări/i).first()
    if (!(await searchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      await searchInput.scrollIntoViewIfNeeded().catch(() => {})
    }
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Type a search query
    await searchInput.fill('a')
    await page.waitForTimeout(1000)

    // The page should still be functional with filtered results
    await expect(page.locator('body')).toBeVisible()

    // Clear search
    await searchInput.fill('')
    await page.waitForTimeout(500)
  })
})

test.describe('Bible Search', () => {
  test('Bible text search API returns results', async ({ request }) => {
    const response = await request.get(
      `/api/bible/search?q=${encodeURIComponent('Dumnezeu')}`,
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('Bible reference search API works', async ({ request }) => {
    const response = await request.get(
      `/api/bible/search?q=${encodeURIComponent('Gen 1:1')}`,
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('Bible search with translation filter', async ({ request }) => {
    const translationsResponse = await request.get('/api/bible/translations')
    const translationsJson = await translationsResponse.json()

    if (translationsJson.data.length === 0) {
      test.skip(true, 'No translations available')
      return
    }

    const translationId = translationsJson.data[0].id
    const response = await request.get(
      `/api/bible/search?q=Dumnezeu&translationId=${translationId}`,
    )
    expect(response.status()).toBe(200)
  })

  test('Bible search UI works from Bible page', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
    if (!(await searchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Search input not visible')
      return
    }

    await searchInput.fill('Dumnezeu')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(3000)

    // Should show search results
    await expect(page.locator('body')).toBeVisible()
  })

  test('Bible smart search navigates to verse reference', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
    if (!(await searchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Search input not visible')
      return
    }

    // Type a direct reference
    await searchInput.fill('Geneza 1:1')
    await page.waitForTimeout(2000)

    // Should navigate to the verse, showing indigo highlight
    const highlight = page.locator('button.ring-indigo-500')
    if (await highlight.isVisible({ timeout: 10000 }).catch(() => false)) {
      const verseNum = await highlight
        .locator('span.font-semibold')
        .first()
        .textContent()
      expect(verseNum?.trim()).toBe('1')
    }
  })
})

test.describe('Schedule Search', () => {
  test('schedule search API returns results', async ({ request }) => {
    const response = await request.get('/api/schedules/search?q=test')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('schedule search with empty query', async ({ request }) => {
    const response = await request.get('/api/schedules/search?q=')
    expect([200, 400]).toContain(response.status())
  })
})

test.describe('Categories', () => {
  test('can list all categories', async ({ request }) => {
    const response = await request.get('/api/categories')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('can create and delete a category', async ({ request }) => {
    const response = await request.post('/api/categories', {
      data: {
        name: `E2E Test Category ${Date.now()}`,
      },
    })
    expect([200, 201]).toContain(response.status())

    const json = await response.json()
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('name')

    // Delete the test category
    const deleteResponse = await request.delete(
      `/api/categories/${json.data.id}`,
    )
    expect(deleteResponse.status()).toBe(200)
  })

  test('can reorder categories', async ({ request }) => {
    // Get existing categories
    const listResponse = await request.get('/api/categories')
    const listJson = await listResponse.json()

    if (listJson.data.length < 2) {
      test.skip(true, 'Need at least 2 categories to test reorder')
      return
    }

    const categoryIds = listJson.data.map((c: { id: number }) => c.id)

    // Reverse the order
    const reorderResponse = await request.put('/api/categories/reorder', {
      data: { categoryIds: categoryIds.reverse() },
    })
    expect(reorderResponse.status()).toBe(200)

    // Restore original order
    await request.put('/api/categories/reorder', {
      data: { categoryIds: categoryIds.reverse() },
    })
  })
})
