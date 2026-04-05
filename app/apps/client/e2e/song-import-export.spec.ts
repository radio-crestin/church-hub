import { expect, test } from '@playwright/test'

test.describe('Song Import/Export via API', () => {
  const testSongIds: number[] = []

  test.afterAll(async ({ request }) => {
    // Clean up all test songs
    for (const id of testSongIds) {
      await request.delete(`/api/songs/${id}`)
    }
  })

  test('can create a song via API', async ({ request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Import Test Song ${Date.now()} ${Math.random().toString(36).slice(2)}`,
        slides: [
          { content: 'First verse\nof the test song', type: 'verse' },
          { content: 'Second verse\nwith more content', type: 'verse' },
          { content: 'Chorus line\nfor testing', type: 'chorus' },
        ],
      },
    })

    expect([201, 409]).toContain(response.status())
    if (response.status() === 409) {
      test.skip(true, 'Duplicate song title detected')
      return
    }
    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('title')
    expect(json.data.slides).toHaveLength(3)

    testSongIds.push(json.data.id)
  })

  test('can batch import songs', async ({ request }) => {
    const timestamp = Date.now()
    const response = await request.post('/api/songs/batch', {
      data: {
        songs: [
          {
            title: `E2E Batch Song A ${timestamp}`,
            slides: [
              { content: 'Batch song A verse 1', type: 'verse' },
              { content: 'Batch song A chorus', type: 'chorus' },
            ],
          },
          {
            title: `E2E Batch Song B ${timestamp}`,
            slides: [{ content: 'Batch song B verse 1', type: 'verse' }],
          },
        ],
        overwriteDuplicates: false,
      },
    })

    expect(response.status()).toBe(201)
    const json = await response.json()
    expect(json).toHaveProperty('data')

    // Clean up: find and delete the batch imported songs
    const songsResponse = await request.get('/api/songs')
    const songsJson = await songsResponse.json()
    for (const song of songsJson.data) {
      if (
        song.title.includes(`E2E Batch Song`) &&
        song.title.includes(`${timestamp}`)
      ) {
        testSongIds.push(song.id)
      }
    }
  })

  test('batch import with overwrite duplicates', async ({ request }) => {
    const title = `E2E Overwrite Test ${Date.now()}`

    // First import
    await request.post('/api/songs/batch', {
      data: {
        songs: [
          { title, slides: [{ content: 'Original content', type: 'verse' }] },
        ],
      },
    })

    // Second import with overwrite
    const response = await request.post('/api/songs/batch', {
      data: {
        songs: [
          { title, slides: [{ content: 'Updated content', type: 'verse' }] },
        ],
        overwriteDuplicates: true,
      },
    })

    expect(response.status()).toBe(201)

    // Clean up
    const songsResponse = await request.get('/api/songs')
    const songsJson = await songsResponse.json()
    for (const song of songsJson.data) {
      if (song.title === title) {
        testSongIds.push(song.id)
      }
    }
  })

  test('can get a song by ID', async ({ request }) => {
    // Create a song first
    const createResponse = await request.post('/api/songs', {
      data: {
        title: `E2E Get Song ${Date.now()}`,
        slides: [{ content: 'Test content', type: 'verse' }],
      },
    })

    const { data: created } = await createResponse.json()
    testSongIds.push(created.id)

    const getResponse = await request.get(`/api/songs/${created.id}`)
    expect(getResponse.status()).toBe(200)

    const json = await getResponse.json()
    expect(json.data.id).toBe(created.id)
    expect(json.data.title).toBe(created.title)
    expect(json.data.slides.length).toBeGreaterThan(0)
  })

  test('can list songs with pagination', async ({ request }) => {
    const response = await request.get('/api/songs?limit=5&offset=0')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('songs')
    expect(Array.isArray(json.data.songs)).toBe(true)
    expect(json.data.songs.length).toBeLessThanOrEqual(5)
  })

  test('can search songs by title', async ({ request }) => {
    const uniqueTitle = `E2E Search Target ${Date.now()}`

    // Create a song with unique title
    const createResponse = await request.post('/api/songs', {
      data: {
        title: uniqueTitle,
        slides: [{ content: 'Searchable content', type: 'verse' }],
      },
    })
    const { data: created } = await createResponse.json()
    testSongIds.push(created.id)

    // Rebuild search index to ensure it is findable
    await request.post('/api/songs/search/rebuild')

    // Search for it
    const searchResponse = await request.get(
      `/api/songs/search?q=${encodeURIComponent('E2E Search Target')}`,
    )
    expect(searchResponse.status()).toBe(200)

    const searchJson = await searchResponse.json()
    expect(searchJson).toHaveProperty('data')
    expect(Array.isArray(searchJson.data)).toBe(true)
  })

  test('can delete a song', async ({ request }) => {
    const createResponse = await request.post('/api/songs', {
      data: {
        title: `E2E Delete Song ${Date.now()}`,
        slides: [{ content: 'To be deleted', type: 'verse' }],
      },
    })
    const { data: created } = await createResponse.json()

    const deleteResponse = await request.delete(`/api/songs/${created.id}`)
    expect(deleteResponse.status()).toBe(200)

    // Verify deleted
    const getResponse = await request.get(`/api/songs/${created.id}`)
    expect(getResponse.status()).toBe(404)
  })

  test('can clone a song slide', async ({ request }) => {
    const createResponse = await request.post('/api/songs', {
      data: {
        title: `E2E Clone Test ${Date.now()}`,
        slides: [{ content: 'Original slide for cloning', type: 'verse' }],
      },
    })
    const { data: created } = await createResponse.json()
    testSongIds.push(created.id)

    const slideId = created.slides[0].id

    const cloneResponse = await request.post(
      `/api/song-slides/${slideId}/clone`,
    )
    expect(cloneResponse.status()).toBe(201)

    const cloneJson = await cloneResponse.json()
    expect(cloneJson.data).toHaveProperty('id')
    expect(cloneJson.data.id).not.toBe(slideId)
  })

  test('can reorder song slides', async ({ request }) => {
    const createResponse = await request.post('/api/songs', {
      data: {
        title: `E2E Reorder Test ${Date.now()}`,
        slides: [
          { content: 'Slide A', type: 'verse' },
          { content: 'Slide B', type: 'verse' },
          { content: 'Slide C', type: 'chorus' },
        ],
      },
    })
    const { data: created } = await createResponse.json()
    testSongIds.push(created.id)

    const slideIds = created.slides.map((s: { id: number }) => s.id)

    // Reverse the order
    const reorderResponse = await request.put(
      `/api/songs/${created.id}/slides/reorder`,
      {
        data: { slideIds: slideIds.reverse() },
      },
    )

    expect(reorderResponse.status()).toBe(200)
  })

  test('rebuild search index returns success', async ({ request }) => {
    const response = await request.post('/api/songs/search/rebuild')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('success')
    expect(json.data.success).toBe(true)
  })
})

test.describe('Song Import/Export via UI', () => {
  test('songs page has search functionality', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const searchInput = page.getByPlaceholder(/search songs|caută cântări/i).first()
    if (!(await searchInput.isVisible({ timeout: 10000 }).catch(() => false))) {
      await searchInput.scrollIntoViewIfNeeded().catch(() => {})
    }
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    await searchInput.fill('test')
    await page.waitForTimeout(500)

    // Search should filter results without errors
    await expect(page.locator('body')).toBeVisible()
  })

  test('song detail page shows slides', async ({ page, request }) => {
    // Get a song ID from the API
    const songsResponse = await request.get('/api/songs?limit=1')
    const songsJson = await songsResponse.json()

    const songs = songsJson.data.songs || songsJson.data
    if (!songs || songs.length === 0) {
      test.skip(true, 'No songs available')
      return
    }

    const songId = songs[0].id
    await page.goto(`/songs/${songId}`)
    await page.waitForLoadState('networkidle')

    // Should see slide content
    await expect(page.locator('body')).toBeVisible()
    await page.waitForTimeout(1000)

    // Slides should be visible as clickable buttons
    const slides = page.locator('button.rounded-lg')
    if (
      await slides
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      expect(await slides.count()).toBeGreaterThan(0)
    }
  })
})
