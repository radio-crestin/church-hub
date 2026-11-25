import { expect, test } from '@playwright/test'

test.describe('Song Import/Export via API', () => {
  const testSongIds: number[] = []

  test.afterAll(async ({ request }) => {
    // Clean up all test songs
    for (const id of testSongIds) {
      await request.delete(`/api/songs/${id}`)
    }
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
    expect(json.data.songIds).toHaveLength(2)

    // Clean up the batch imported songs
    testSongIds.push(...json.data.songIds)
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
    testSongIds.push(...(await response.json()).data.songIds)
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
})
