import { expect, test } from '@playwright/test'

/**
 * Song stage extras:
 *  1. Mark a bookmarked song as "sung" from the Marcaje (bookmarks) column.
 *  2. Filter that list by all / pending / sung.
 *  3. Per-slide speaker notes in the panel below the canvas (PowerPoint mode).
 */
test.describe('Song bookmarks sung state + filter', () => {
  test('mark a bookmark sung and filter the list', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const titleA = `E2E Sung A ${uniq}`
    const titleB = `E2E Sung B ${uniq}`

    const resA = await request.post('/api/songs', {
      data: { title: titleA, slides: [{ content: 'A', sortOrder: 0 }] },
    })
    const resB = await request.post('/api/songs', {
      data: { title: titleB, slides: [{ content: 'B', sortOrder: 0 }] },
    })
    const { data: songA } = await resA.json()
    const { data: songB } = await resB.json()
    await request.post('/api/song-bookmarks', { data: { songId: songA.id } })
    await request.post('/api/song-bookmarks', { data: { songId: songB.id } })

    try {
      await page.addInitScript(() => {})
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${songA.id}`)
      await page.waitForLoadState('networkidle')

      const rowA = page.getByTestId('bookmark-item').filter({ hasText: titleA })
      const rowB = page.getByTestId('bookmark-item').filter({ hasText: titleB })
      await expect(rowA).toBeVisible({ timeout: 10000 })
      await expect(rowB).toBeVisible()

      // Mark song A as sung.
      await rowA.getByTestId('bookmark-sung-toggle').click()

      // It persists on the server.
      await expect
        .poll(
          async () => {
            const res = await request.get('/api/song-bookmarks')
            const { data } = await res.json()
            return data.find(
              (b: { songId: number; isSung: boolean }) => b.songId === songA.id,
            )?.isSung
          },
          { timeout: 10000 },
        )
        .toBe(true)

      // Filter: "sung" shows only A; "pending" shows only B; "all" shows both.
      await page.getByTestId('bookmark-filter-sung').click()
      await expect(rowA).toBeVisible()
      await expect(rowB).toHaveCount(0)

      await page.getByTestId('bookmark-filter-pending').click()
      await expect(rowB).toBeVisible()
      await expect(rowA).toHaveCount(0)

      await page.getByTestId('bookmark-filter-all').click()
      await expect(rowA).toBeVisible()
      await expect(rowB).toBeVisible()
    } finally {
      await request.delete(`/api/song-bookmarks/${songA.id}`).catch(() => {})
      await request.delete(`/api/song-bookmarks/${songB.id}`).catch(() => {})
      await request.delete(`/api/songs/${songA.id}`)
      await request.delete(`/api/songs/${songB.id}`)
    }
  })
})

test.describe('Per-slide speaker notes', () => {
  test('typing a note persists it to the active slide', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const res = await request.post('/api/songs', {
      data: {
        title: `E2E Notes ${uniq}`,
        slides: [
          { content: 'Verse one', sortOrder: 0 },
          { content: 'Verse two', sortOrder: 1 },
        ],
      },
    })
    const { data: song } = await res.json()

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
        window.localStorage.setItem('song-stage:notes-collapsed', 'false')
      })
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(2, {
        timeout: 10000,
      })

      const notes = page.getByTestId('slide-notes-textarea')
      await expect(notes).toBeVisible()

      // Type a note for slide 1 (the active slide on load).
      await notes.fill('Dim the lights here')

      // It persists to slide 0 on the server.
      await expect
        .poll(
          async () => {
            const r = await request.get(`/api/songs/${song.id}`)
            const { data } = await r.json()
            return data.slides[0].notes
          },
          { timeout: 10000 },
        )
        .toBe('Dim the lights here')

      // Switching to slide 2 shows an empty note (notes are per-slide).
      await page.getByTestId('stage-thumbnail').nth(1).click()
      await expect(notes).toHaveValue('')

      // Switching back shows slide 1's note again.
      await page.getByTestId('stage-thumbnail').nth(0).click()
      await expect(notes).toHaveValue('Dim the lights here')
    } finally {
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
