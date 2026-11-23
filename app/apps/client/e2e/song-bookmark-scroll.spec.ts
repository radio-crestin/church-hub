import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A song just bookmarked lands at the end of the Marcaje list; the list
 * scrolls down to it rather than leaving it below the fold.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

test('a song just bookmarked is scrolled into view at the bottom of a long list', async ({
  page,
  request,
}) => {
  const uniq = Date.now()
  const songs: Array<{ id: number }> = []
  try {
    for (let i = 0; i < 25; i++) {
      songs.push(await createSong(request, `E2E Scroll ${i} ${uniq}`))
    }
    const target = songs[songs.length - 1]
    for (const song of songs.slice(0, -1)) {
      await request.post('/api/song-bookmarks', { data: { songId: song.id } })
    }

    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/')
    await page.evaluate(() =>
      localStorage.setItem('song-detail:bookmarks-open', 'true'),
    )
    await page.goto(`/songs/${target.id}`)

    const list = page.getByTestId('bookmarks-list')
    const mine = list
      .getByTestId('bookmark-item')
      .filter({ hasText: `${uniq}` })
    await expect(mine).toHaveCount(24, { timeout: 15000 })
    const isScrolledToBottom = () =>
      list.evaluate(
        (el) => el.scrollHeight - el.scrollTop - el.clientHeight < 2,
      )
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
      true,
    )
    expect(await isScrolledToBottom()).toBe(false)

    await page.getByTestId('song-bookmark-toggle').click()

    await expect(mine).toHaveCount(25)
    await expect.poll(isScrolledToBottom).toBe(true)
    await expect(
      mine.filter({ hasText: `E2E Scroll 24 ${uniq}` }),
    ).toBeInViewport()
  } finally {
    const bookmarks = (await (await request.get('/api/song-bookmarks')).json())
      .data as Array<{ id: number; songId: number }>
    for (const bookmark of bookmarks) {
      if (songs.some((song) => song.id === bookmark.songId)) {
        await request.delete(`/api/song-bookmarks/${bookmark.id}`)
      }
    }
    for (const song of songs) {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  }
})
