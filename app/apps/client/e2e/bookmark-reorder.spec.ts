import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * Reordering bookmarks:
 * - the reordered songs must stay in the list (an optimistic update once wiped
 *   the whole bookmarks cache, so the songs vanished from "Toate" and the song
 *   page lost its bookmark icon),
 * - and the "Ramase"/"Cantate" tabs must be sortable too, without disturbing
 *   the rows the filter hides.
 *
 * The panel may already hold the operator's own bookmarks, so everything here
 * is scoped to the songs the test created rather than to absolute positions.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

async function listBookmarks(request: APIRequestContext) {
  const response = await request.get('/api/song-bookmarks')
  return (await response.json()).data as Array<{
    id: number
    songId: number
    songTitle: string
    sortOrder: number
    isSung: boolean
  }>
}

/** Ids of the test's own songs, in the order the bookmark list holds them. */
async function orderOfMine(request: APIRequestContext, songIds: number[]) {
  const bookmarks = await listBookmarks(request)
  return bookmarks
    .filter((bookmark) => songIds.includes(bookmark.songId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((bookmark) => bookmark.songId)
}

async function dragRowBelow(page: Page, source: unknown, target: unknown) {
  const from = source as ReturnType<Page['locator']>
  const to = target as ReturnType<Page['locator']>
  // The drag listeners live on the grip, not the whole row.
  await from.getByTestId('bookmark-drag-handle').hover()
  await page.mouse.down()
  const box = await to.boundingBox()
  if (!box) throw new Error('bookmark row has no box')
  // Two moves: the first crosses dnd-kit's 8px activation distance, the second
  // lands past the target's midpoint so the drop is registered after it.
  await page.mouse.move(box.x + box.width / 2, box.y, { steps: 5 })
  await page.mouse.move(box.x + box.width / 2, box.y + box.height, {
    steps: 10,
  })
  await page.mouse.up()
}

async function cleanup(
  request: APIRequestContext,
  songs: Array<{ id: number }>,
) {
  const bookmarks = await listBookmarks(request)
  for (const bookmark of bookmarks) {
    if (songs.some((song) => song.id === bookmark.songId)) {
      await request.delete(`/api/song-bookmarks/${bookmark.id}`).catch(() => {})
    }
  }
  for (const song of songs) {
    await request.delete(`/api/songs/${song.id}`).catch(() => {})
  }
}

test.describe('Bookmark reordering', () => {
  test('reordering keeps every bookmarked song in the list', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const songs = [
      await createSong(request, `E2E Reorder A ${uniq}`),
      await createSong(request, `E2E Reorder B ${uniq}`),
      await createSong(request, `E2E Reorder C ${uniq}`),
    ]
    const songIds = songs.map((song) => song.id)

    try {
      for (const song of songs) {
        await request.post('/api/song-bookmarks', { data: { songId: song.id } })
      }

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${songs[0].id}`)
      await page.waitForLoadState('networkidle')

      const mine = page
        .getByTestId('bookmark-item')
        .filter({ hasText: `${uniq}` })
      await expect(mine).toHaveCount(3, { timeout: 10000 })

      await dragRowBelow(page, mine.nth(0), mine.nth(1))

      // All three survive the reorder — in the list and in the cache the
      // bookmark icon reads from.
      await expect(mine).toHaveCount(3)
      // The order changed and nothing was lost. Which slot the row lands in
      // depends on where the operator drops it; what matters here is that the
      // other bookmarks did not disappear along the way.
      await expect
        .poll(() => orderOfMine(request, songIds), { timeout: 10000 })
        .not.toEqual(songIds)
      expect(await orderOfMine(request, songIds)).toHaveLength(3)
      await expect(page.getByTestId('song-bookmark-toggle')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    } finally {
      await cleanup(request, songs)
    }
  })

  test('the Ramase tab can be reordered without moving the sung songs', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const songs = [
      await createSong(request, `E2E Pending A ${uniq}`),
      await createSong(request, `E2E Sung B ${uniq}`),
      await createSong(request, `E2E Pending C ${uniq}`),
    ]
    const songIds = songs.map((song) => song.id)

    try {
      const created: number[] = []
      for (const song of songs) {
        const response = await request.post('/api/song-bookmarks', {
          data: { songId: song.id },
        })
        created.push((await response.json()).data.id)
      }
      // The middle bookmark is sung, so "Ramase" shows the outer two.
      await request.put(`/api/song-bookmarks/${created[1]}/sung`, {
        data: { isSung: true },
      })

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${songs[0].id}`)
      await page.waitForLoadState('networkidle')

      await expect
        .poll(() => orderOfMine(request, songIds), { timeout: 10000 })
        .toEqual(songIds)

      await page.getByTestId('bookmark-filter-pending').click()
      const mine = page
        .getByTestId('bookmark-item')
        .filter({ hasText: `${uniq}` })
      await expect(mine).toHaveCount(2, { timeout: 10000 })

      // Dragging works in a filtered tab — the grip used to be dropped there.
      await dragRowBelow(page, mine.nth(0), mine.nth(1))

      // The two pending songs swapped; the sung one kept its middle slot.
      await expect
        .poll(() => orderOfMine(request, songIds), { timeout: 10000 })
        .toEqual([songIds[2], songIds[1], songIds[0]])
    } finally {
      await cleanup(request, songs)
    }
  })
})
