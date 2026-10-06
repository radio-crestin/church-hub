import { expect, test } from '@playwright/test'

/**
 * GET /api/songs is always paginated: without `limit` it returns the first
 * page (50 songs), never the whole library (which was ~12 MB on a real DB).
 * The settings "Uncategorized" card asks for just the songs without a
 * category instead of downloading every song.
 */

const DEFAULT_PAGE_SIZE = 50

test.describe('Songs API pagination', () => {
  test('without a limit it returns one default-sized page', async ({
    request,
  }) => {
    const res = await request.get('/api/songs')
    expect(res.ok()).toBeTruthy()
    const { data } = await res.json()

    expect(Array.isArray(data.songs)).toBe(true)
    expect(data.songs.length).toBeLessThanOrEqual(DEFAULT_PAGE_SIZE)
    expect(data.songs.length).toBe(Math.min(data.total, DEFAULT_PAGE_SIZE))
    expect(data.hasMore).toBe(data.total > DEFAULT_PAGE_SIZE)
  })

  test('an explicit limit and offset still page through the list', async ({
    request,
  }) => {
    const first = await (
      await request.get('/api/songs?limit=3&offset=0&sortBy=title')
    ).json()
    const second = await (
      await request.get('/api/songs?limit=3&offset=3&sortBy=title')
    ).json()

    expect(first.data.songs.length).toBeLessThanOrEqual(3)
    const firstIds = first.data.songs.map((s: { id: number }) => s.id)
    for (const song of second.data.songs as Array<{ id: number }>) {
      expect(firstIds).not.toContain(song.id)
    }
  })

  test('uncategorizedOnly returns only songs without a category', async ({
    request,
  }) => {
    const title = `E2E Uncategorized ${Date.now()}`
    const created = await request.post('/api/songs', {
      data: { title, slides: [{ content: 'no category', type: 'verse' }] },
    })
    const songId = (await created.json()).data.id as number

    try {
      const res = await request.get(
        '/api/songs?uncategorizedOnly=true&limit=500&sortBy=newest',
      )
      const { data } = await res.json()
      const songs = data.songs as Array<{ id: number; categoryId: number }>

      expect(songs.every((song) => song.categoryId === null)).toBe(true)
      expect(songs.some((song) => song.id === songId)).toBe(true)
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => {})
    }
  })

  test('the settings "Uncategorized" card loads only uncategorized songs', async ({
    page,
  }) => {
    const songListUrls: URL[] = []
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (req.method() === 'GET' && url.pathname === '/api/songs') {
        songListUrls.push(url)
      }
    })

    const uncategorizedResponse = page.waitForResponse((res) =>
      res.url().includes('uncategorizedOnly=true'),
    )
    await page.goto('/settings/songs')
    const { data } = await (await uncategorizedResponse).json()

    if (data.total > 0) {
      await expect(
        page.getByText(
          // Romanian says "20 de cântări" from 20 up.
          new RegExp(`${data.total} (de )?(cântări|cântare|songs?) `, 'i'),
        ),
      ).toBeVisible()
    }
    expect(songListUrls.length).toBeGreaterThan(0)
    for (const url of songListUrls) {
      expect(url.searchParams.get('limit')).not.toBeNull()
    }
  })
})
