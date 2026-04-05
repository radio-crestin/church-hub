import { expect, test } from '@playwright/test'

/**
 * Comprehensive API endpoint tests covering all documented endpoints.
 * These tests verify status codes, response shapes, and basic CRUD operations.
 */

test.describe('Health & Connectivity', () => {
  test('ping endpoint returns pong', async ({ request }) => {
    const response = await request.get('/api/ping')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
    expect(json.data).toBe('pong')
  })

  test('API docs page is accessible', async ({ request }) => {
    const response = await request.get('/api/docs')
    expect(response.status()).toBe(200)
  })

  test('database info endpoint works', async ({ request }) => {
    const response = await request.get('/api/database/info')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('path')
    expect(json.data).toHaveProperty('dataDir')
    expect(json.data).toHaveProperty('sizeBytes')
  })
})

test.describe('Bible API - Translations', () => {
  test('GET /api/bible/translations returns array', async ({ request }) => {
    const response = await request.get('/api/bible/translations')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/bible/translations/:id works for existing translation', async ({
    request,
  }) => {
    const listResponse = await request.get('/api/bible/translations')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No translations available')
      return
    }

    const id = listJson.data[0].id
    const response = await request.get(`/api/bible/translations/${id}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('id')
    expect(json.data.id).toBe(id)
  })

  test('GET /api/bible/translations/:id returns 404 for non-existent', async ({
    request,
  }) => {
    const response = await request.get('/api/bible/translations/999999')
    expect(response.status()).toBe(404)
  })
})

test.describe('Bible API - Books & Chapters', () => {
  test('GET /api/bible/books/:translationId returns books', async ({
    request,
  }) => {
    const translationsResponse = await request.get('/api/bible/translations')
    const translationsJson = await translationsResponse.json()

    if (translationsJson.data.length === 0) {
      test.skip(true, 'No translations available')
      return
    }

    const translationId = translationsJson.data[0].id
    const response = await request.get(`/api/bible/books/${translationId}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)

    // Each book should have id and bookName
    expect(json.data[0]).toHaveProperty('id')
    expect(json.data[0]).toHaveProperty('bookName')
  })

  test('GET /api/bible/chapters/:bookId returns chapters', async ({
    request,
  }) => {
    const translationsResponse = await request.get('/api/bible/translations')
    const translationsJson = await translationsResponse.json()

    if (translationsJson.data.length === 0) {
      test.skip(true, 'No translations available')
      return
    }

    const booksResponse = await request.get(
      `/api/bible/books/${translationsJson.data[0].id}`,
    )
    const booksJson = await booksResponse.json()

    if (booksJson.data.length === 0) {
      test.skip(true, 'No books available')
      return
    }

    const bookId = booksJson.data[0].id
    const response = await request.get(`/api/bible/chapters/${bookId}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)
  })
})

test.describe('Bible API - Verses', () => {
  let testBookId: number
  let testVerseId: number

  test.beforeAll(async ({ request }) => {
    const translationsResponse = await request.get('/api/bible/translations')
    const translationsJson = await translationsResponse.json()

    if (translationsJson.data.length === 0) return

    const booksResponse = await request.get(
      `/api/bible/books/${translationsJson.data[0].id}`,
    )
    const booksJson = await booksResponse.json()

    if (booksJson.data.length === 0) return
    testBookId = booksJson.data[0].id

    const versesResponse = await request.get(
      `/api/bible/verses/${testBookId}/1`,
    )
    const versesJson = await versesResponse.json()

    if (versesJson.data.length > 0) {
      testVerseId = versesJson.data[0].id
    }
  })

  test('GET /api/bible/verses/:bookId/:chapter returns verses', async ({
    request,
  }) => {
    if (!testBookId) {
      test.skip(true, 'No test book available')
      return
    }

    const response = await request.get(`/api/bible/verses/${testBookId}/1`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThan(0)

    // Each verse should have id, text, verseNumber
    expect(json.data[0]).toHaveProperty('id')
    expect(json.data[0]).toHaveProperty('text')
  })

  test('GET /api/bible/verse/:id returns single verse', async ({ request }) => {
    if (!testVerseId) {
      test.skip(true, 'No test verse available')
      return
    }

    const response = await request.get(`/api/bible/verse/${testVerseId}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('id')
    expect(json.data.id).toBe(testVerseId)
  })

  test('GET /api/bible/next-verse/:verseId returns next verse', async ({
    request,
  }) => {
    if (!testVerseId) {
      test.skip(true, 'No test verse available')
      return
    }

    const response = await request.get(`/api/bible/next-verse/${testVerseId}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    // Can be a verse object or null (if last verse in Bible)
    if (json.data !== null) {
      expect(json.data).toHaveProperty('id')
    }
  })

  test('GET /api/bible/search works for text search', async ({ request }) => {
    const response = await request.get(
      `/api/bible/search?q=${encodeURIComponent('Dumnezeu')}`,
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('GET /api/bible/search works for reference search', async ({
    request,
  }) => {
    const response = await request.get(
      `/api/bible/search?q=${encodeURIComponent('Geneza 1:1')}`,
    )
    expect(response.status()).toBe(200)
  })
})

test.describe('Songs API - CRUD', () => {
  let createdSongId: number

  test('GET /api/songs returns paginated list', async ({ request }) => {
    const response = await request.get('/api/songs?limit=10&offset=0')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('songs')
    expect(Array.isArray(json.data.songs)).toBe(true)
    expect(json.data).toHaveProperty('total')
    expect(json.data).toHaveProperty('hasMore')
  })

  test('GET /api/songs with presentedOnly filter', async ({ request }) => {
    const response = await request.get('/api/songs?presentedOnly=true&limit=5')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('songs')
    expect(Array.isArray(json.data.songs)).toBe(true)
  })

  test('GET /api/songs with inSchedulesOnly filter', async ({ request }) => {
    const response = await request.get(
      '/api/songs?inSchedulesOnly=true&limit=5',
    )
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('songs')
    expect(Array.isArray(json.data.songs)).toBe(true)
  })

  test('POST /api/songs creates a song', async ({ request }) => {
    const response = await request.post('/api/songs', {
      data: {
        title: `E2E Unique Song ${Date.now()} ${Math.random().toString(36).slice(2)}`,
        slides: [
          { content: 'API test verse 1', type: 'verse' },
          { content: 'API test chorus', type: 'chorus' },
        ],
      },
    })

    expect([200, 409]).toContain(response.status())
    if (response.status() === 409) {
      test.skip(true, 'Duplicate song title detected')
      return
    }
    const json = await response.json()
    expect(json.data).toHaveProperty('id')
    createdSongId = json.data.id
  })

  test('GET /api/songs/:id returns song with slides', async ({ request }) => {
    if (!createdSongId) {
      test.skip(true, 'No test song created')
      return
    }

    const response = await request.get(`/api/songs/${createdSongId}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data.id).toBe(createdSongId)
    expect(json.data).toHaveProperty('slides')
    expect(json.data.slides.length).toBeGreaterThan(0)
  })

  test('GET /api/songs/:id returns 404 for non-existent', async ({
    request,
  }) => {
    const response = await request.get('/api/songs/999999')
    expect(response.status()).toBe(404)
  })

  test('DELETE /api/songs/:id deletes the song', async ({ request }) => {
    if (!createdSongId) {
      test.skip(true, 'No test song to delete')
      return
    }

    const response = await request.delete(`/api/songs/${createdSongId}`)
    expect(response.status()).toBe(200)
  })
})

test.describe('Song Slides API', () => {
  let songId: number
  let slideId: number

  test.beforeAll(async ({ request }) => {
    const createResponse = await request.post('/api/songs', {
      data: {
        title: `Slide Test ${Date.now()} ${Math.random().toString(36).slice(2)}`,
        slides: [{ content: 'Original slide', type: 'verse' }],
      },
    })
    if (createResponse.status() === 200) {
      const json = await createResponse.json()
      songId = json.data.id
      slideId = json.data.slides[0].id
    }
  })

  test.afterAll(async ({ request }) => {
    if (songId) {
      await request.delete(`/api/songs/${songId}`)
    }
  })

  test('POST /api/song-slides creates a slide', async ({ request }) => {
    if (!songId) {
      test.skip(true, 'No test song created')
      return
    }

    const response = await request.post('/api/song-slides', {
      data: {
        songId,
        content: 'New slide content',
        type: 'verse',
      },
    })

    expect(response.status()).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveProperty('id')
  })

  test('POST /api/song-slides/:id/clone clones a slide', async ({
    request,
  }) => {
    if (!slideId) {
      test.skip(true, 'No test slide created')
      return
    }

    const response = await request.post(`/api/song-slides/${slideId}/clone`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('id')
    expect(json.data.id).not.toBe(slideId)
  })

  test('DELETE /api/song-slides/:id deletes a slide', async ({ request }) => {
    if (!songId) {
      test.skip(true, 'No test song created')
      return
    }

    // Create a slide to delete
    const createResponse = await request.post('/api/song-slides', {
      data: {
        songId,
        content: 'To be deleted',
        type: 'verse',
      },
    })
    const { data: created } = await createResponse.json()

    const response = await request.delete(`/api/song-slides/${created.id}`)
    expect(response.status()).toBe(200)
  })
})

test.describe('Schedules API - CRUD', () => {
  let scheduleId: number

  test('GET /api/schedules returns list', async ({ request }) => {
    const response = await request.get('/api/schedules')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('POST /api/schedules creates a schedule', async ({ request }) => {
    const response = await request.post('/api/schedules', {
      data: {
        title: `E2E Schedule ${Date.now()} ${Math.random().toString(36).slice(2)}`,
        date: new Date().toISOString().split('T')[0],
      },
    })

    expect([200, 409]).toContain(response.status())
    if (response.status() !== 200) {
      test.skip(true, 'Could not create schedule')
      return
    }
    const json = await response.json()
    expect(json.data).toHaveProperty('id')
    scheduleId = json.data.id
  })

  test('GET /api/schedules/:id returns schedule', async ({ request }) => {
    if (!scheduleId) {
      test.skip(true, 'No test schedule')
      return
    }

    const response = await request.get(`/api/schedules/${scheduleId}`)
    expect(response.status()).toBe(200)
  })

  test('GET /api/schedules/search works', async ({ request }) => {
    const response = await request.get('/api/schedules/search?q=API')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('DELETE /api/schedules/:id deletes schedule', async ({ request }) => {
    if (!scheduleId) {
      test.skip(true, 'No test schedule')
      return
    }

    const response = await request.delete(`/api/schedules/${scheduleId}`)
    expect(response.status()).toBe(200)
  })
})

test.describe('Screens API', () => {
  test('GET /api/screens returns list', async ({ request }) => {
    const response = await request.get('/api/screens')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/screens/:id returns screen with configs', async ({
    request,
  }) => {
    const listResponse = await request.get('/api/screens')
    const listJson = await listResponse.json()

    if (listJson.data.length === 0) {
      test.skip(true, 'No screens available')
      return
    }

    const id = listJson.data[0].id
    const response = await request.get(`/api/screens/${id}`)
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('id')
  })
})

test.describe('Presentation API', () => {
  test('GET /api/presentation/state returns state', async ({ request }) => {
    const response = await request.get('/api/presentation/state')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json).toHaveProperty('data')
  })

  test('POST /api/presentation/stop returns state', async ({ request }) => {
    const response = await request.post('/api/presentation/stop')
    expect(response.status()).toBe(200)
  })

  test('POST /api/presentation/clear returns state', async ({ request }) => {
    const response = await request.post('/api/presentation/clear')
    expect(response.status()).toBe(200)
  })

  test('POST /api/presentation/show returns state', async ({ request }) => {
    const response = await request.post('/api/presentation/show')
    expect(response.status()).toBe(200)
  })
})

test.describe('Settings API', () => {
  test('GET /api/settings/app_settings returns settings', async ({
    request,
  }) => {
    const response = await request.get('/api/settings/app_settings')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/settings/user_preferences returns settings', async ({
    request,
  }) => {
    const response = await request.get('/api/settings/user_preferences')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/settings/cache_metadata returns settings', async ({
    request,
  }) => {
    const response = await request.get('/api/settings/cache_metadata')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('POST + GET + DELETE setting lifecycle', async ({ request }) => {
    const key = `api_test_${Date.now()}`

    // Create
    const createResponse = await request.post('/api/settings/app_settings', {
      data: { key, value: 'test_value' },
    })
    expect(createResponse.status()).toBe(200)

    // Read
    const getResponse = await request.get(`/api/settings/app_settings/${key}`)
    expect(getResponse.status()).toBe(200)
    const getData = await getResponse.json()
    expect(getData.data.value).toBe('test_value')

    // Delete
    const deleteResponse = await request.delete(
      `/api/settings/app_settings/${key}`,
    )
    expect(deleteResponse.status()).toBe(200)

    // Verify gone
    const verifyResponse = await request.get(
      `/api/settings/app_settings/${key}`,
    )
    const verifyData = await verifyResponse.json()
    expect(verifyData.data).toBeNull()
  })
})

test.describe('Categories API', () => {
  test('GET /api/categories returns list', async ({ request }) => {
    const response = await request.get('/api/categories')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('POST + DELETE category lifecycle', async ({ request }) => {
    const createResponse = await request.post('/api/categories', {
      data: { name: `E2E Cat ${Date.now()} ${Math.random().toString(36).slice(2)}` },
    })
    expect([200, 409]).toContain(createResponse.status())
    if (createResponse.status() !== 200) {
      test.skip(true, 'Could not create category')
      return
    }

    const { data: created } = await createResponse.json()
    expect(created).toHaveProperty('id')

    const deleteResponse = await request.delete(`/api/categories/${created.id}`)
    expect(deleteResponse.status()).toBe(200)
  })
})

test.describe('Conversion API', () => {
  test('GET /api/convert/check-libreoffice returns status', async ({
    request,
  }) => {
    const response = await request.get('/api/convert/check-libreoffice')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('installed')
    expect(typeof json.data.installed).toBe('boolean')
  })
})

test.describe('Music API', () => {
  test('GET /api/music/player/status returns status', async ({ request }) => {
    const response = await request.get('/api/music/player/status')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('installed')
    expect(json.data).toHaveProperty('available')
  })

  test('GET /api/music/folders returns folders', async ({ request }) => {
    const response = await request.get('/api/music/folders')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/music/files returns files', async ({ request }) => {
    const response = await request.get('/api/music/files')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('GET /api/music/playlists returns playlists', async ({ request }) => {
    const response = await request.get('/api/music/playlists')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(Array.isArray(json.data)).toBe(true)
  })
})

test.describe('Database API', () => {
  test('GET /api/database/info returns info', async ({ request }) => {
    const response = await request.get('/api/database/info')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data).toHaveProperty('path')
    expect(json.data).toHaveProperty('sizeBytes')
    expect(json.data.sizeBytes).toBeGreaterThan(0)
  })

  test('POST /api/database/rebuild-search-indexes works', async ({
    request,
  }) => {
    const response = await request.post('/api/database/rebuild-search-indexes')
    expect(response.status()).toBe(200)

    const json = await response.json()
    expect(json.data.success).toBe(true)
  })
})
