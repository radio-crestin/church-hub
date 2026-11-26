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
    const listResponse = await request.get('/api/categories')
    const original = (await listResponse.json()).data as Array<{
      id: number
      name: string
      priority: number
    }>

    if (original.length < 2) {
      test.skip(true, 'Need at least 2 categories to test reorder')
      return
    }

    try {
      const reorderResponse = await request.put('/api/categories/reorder', {
        data: { categoryIds: original.map((c) => c.id).reverse() },
      })
      expect(reorderResponse.status()).toBe(200)
    } finally {
      // Put every priority back as it was. Reordering again cannot: it
      // renumbers N..1, and the seeded categories all start at 1. Left
      // renumbered, they reorder every later spec's search results.
      for (const { id, name, priority } of original) {
        await request.post('/api/categories', { data: { id, name, priority } })
      }
    }
  })
})
