import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

/**
 * Carrying a song out of Marcaje and onto Programe.
 *
 * The drag runs on pointer events rather than the native HTML5 API — the
 * desktop webview drops custom MIME types and the file-import overlay listens
 * on the same channel — so the gesture is a plain mouse press, a few pixels of
 * travel, and a release over the Programe panel. The song is copied: it stays
 * marked, and the selected program gains it.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

async function createProgram(request: APIRequestContext, title: string) {
  const response = await request.post('/api/schedules', {
    data: { title, date: new Date().toISOString().slice(0, 10) },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

/** Song ids currently in a program, in order. */
async function programSongIds(
  request: APIRequestContext,
  scheduleId: number,
): Promise<number[]> {
  const response = await request.get(`/api/schedules/${scheduleId}`)
  const { data } = await response.json()
  return (data.items ?? [])
    .map((item: { songId?: number | null }) => item.songId)
    .filter(
      (id: number | null | undefined): id is number => typeof id === 'number',
    )
}

/** Presses on `source`, travels to `target` and releases there. */
async function dragOnto(page: Page, source: Locator, target: Locator) {
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('drag source or target is not on screen')

  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  // Past the 6px the controller waits for before a press becomes a drag, then
  // onto the target in steps so the zone under the pointer is tracked.
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 5 })
  await page.mouse.move(end.x, end.y, { steps: 20 })
  await page.mouse.move(end.x, end.y, { steps: 3 })
  await page.mouse.up()
}

test.describe.configure({ mode: 'serial' })

test.describe('Drag a marked song into a program', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('song-detail:bookmarks-open', 'true')
      window.localStorage.setItem('song-detail:schedules-open', 'true')
      window.localStorage.setItem('song-detail:versions-open', 'false')
      window.localStorage.setItem('songs-list:bookmarks-open', 'true')
      window.localStorage.setItem('songs-list:schedules-open', 'true')
      window.localStorage.setItem('song-editor-layout', 'normal')
    })
  })

  test('from inside a song, the marked song lands in the selected program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const open = await createSong(request, `E2E Drag Host ${uniq}`)
    const marked = await createSong(request, `E2E Drag Marked ${uniq}`)
    const program = await createProgram(request, `E2E Drag Program ${uniq}`)

    try {
      await request.delete('/api/song-bookmarks')
      expect(
        (
          await request.post('/api/song-bookmarks', {
            data: { songId: marked.id },
          })
        ).status(),
      ).toBe(201)

      await page.goto(`/songs/${open.id}`)
      const row = page.getByTestId('bookmark-song-drag').filter({
        hasText: marked.title,
      })
      await expect(row).toBeVisible({ timeout: 15000 })
      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible()

      await dragOnto(page, row, panel)

      await expect
        .poll(async () => await programSongIds(request, program.id), {
          timeout: 10000,
        })
        .toContain(marked.id)

      // Copied, not moved: it is still marked, and the page did not navigate
      // to the dragged song.
      const bookmarks = await request.get('/api/song-bookmarks')
      const { data } = await bookmarks.json()
      expect(
        (data as Array<{ songId: number }>).some((b) => b.songId === marked.id),
      ).toBe(true)
      await expect(page).toHaveURL(new RegExp(`/songs/${open.id}`))
    } finally {
      await request.delete(`/api/schedules/${program.id}`)
      await request.delete('/api/song-bookmarks')
      await request.delete(`/api/songs/${open.id}`)
      await request.delete(`/api/songs/${marked.id}`)
    }
  })

  test('the same drag works from the list of all songs', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const marked = await createSong(request, `E2E Drag List ${uniq}`)
    const program = await createProgram(
      request,
      `E2E Drag List Program ${uniq}`,
    )

    try {
      await request.delete('/api/song-bookmarks')
      expect(
        (
          await request.post('/api/song-bookmarks', {
            data: { songId: marked.id },
          })
        ).status(),
      ).toBe(201)

      await page.goto('/songs')
      const row = page.getByTestId('bookmark-song-drag').filter({
        hasText: marked.title,
      })
      await expect(row).toBeVisible({ timeout: 15000 })
      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible()

      await dragOnto(page, row, panel)

      await expect
        .poll(async () => await programSongIds(request, program.id), {
          timeout: 10000,
        })
        .toContain(marked.id)
    } finally {
      await request.delete(`/api/schedules/${program.id}`)
      await request.delete('/api/song-bookmarks')
      await request.delete(`/api/songs/${marked.id}`)
    }
  })
})

/**
 * The song list rows are draggable too.
 *
 * The grip that used to start this was replaced by two labelled buttons, which
 * left `startSongDrag` with no caller at all — the drop zones on Marcaje and
 * Programe were live and nothing could reach them. The row itself is the drag
 * source now, so both ways of getting a song into a panel are available: carry
 * it, or press the button.
 */
test.describe('Drag a song out of the list', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('songs-list:bookmarks-open', 'true')
      window.localStorage.setItem('songs-list:schedules-open', 'true')
    })
  })

  test('a row carried onto Programe lands in the selected program', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const song = await createSong(request, `E2E List Drag ${uniq}`)
    const program = await createProgram(request, `E2E List Drag Prog ${uniq}`)

    try {
      await page.goto(`/songs?q=${encodeURIComponent(song.title)}`)
      const row = page.getByTestId('song-card-open').filter({
        hasText: song.title,
      })
      await expect(row).toBeVisible({ timeout: 15000 })
      const panel = page.getByTestId('schedule-songs-panel')
      await expect(panel).toBeVisible()

      await dragOnto(page, row, panel)

      await expect
        .poll(async () => await programSongIds(request, program.id), {
          timeout: 10000,
        })
        .toContain(song.id)
      // Carrying the row must not also open the song.
      await expect(page).toHaveURL(/\/songs(\?|$)/)
    } finally {
      await request.delete(`/api/schedules/${program.id}`)
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('a row carried onto Marcaje marks the song', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E List Drag Mark ${Date.now()}`)

    try {
      await request.delete('/api/song-bookmarks')
      await page.goto(`/songs?q=${encodeURIComponent(song.title)}`)
      const row = page.getByTestId('song-card-open').filter({
        hasText: song.title,
      })
      await expect(row).toBeVisible({ timeout: 15000 })
      const panel = page.getByTestId('bookmarks-drop-zone')
      await expect(panel).toBeVisible()

      await dragOnto(page, row, panel)

      await expect
        .poll(
          async () => {
            const response = await request.get('/api/song-bookmarks')
            const { data } = await response.json()
            return (data as Array<{ songId: number }>).map((b) => b.songId)
          },
          { timeout: 10000 },
        )
        .toContain(song.id)
    } finally {
      await request.delete('/api/song-bookmarks')
      await request.delete(`/api/songs/${song.id}`)
    }
  })

  test('the two row buttons are still there and still work', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E List Buttons ${Date.now()}`)

    try {
      await request.delete('/api/song-bookmarks')
      await page.goto(`/songs?q=${encodeURIComponent(song.title)}`)
      const card = page.getByTestId('song-card').filter({ hasText: song.title })
      await expect(card).toBeVisible({ timeout: 15000 })

      await expect(card.getByTestId('song-card-bookmark')).toBeVisible()
      await expect(card.getByTestId('song-card-add-to-schedule')).toBeVisible()

      await card.getByTestId('song-card-bookmark').click()
      await expect
        .poll(
          async () => {
            const response = await request.get('/api/song-bookmarks')
            const { data } = await response.json()
            return (data as Array<{ songId: number }>).map((b) => b.songId)
          },
          { timeout: 10000 },
        )
        .toContain(song.id)
    } finally {
      await request.delete('/api/song-bookmarks')
      await request.delete(`/api/songs/${song.id}`)
    }
  })
})
