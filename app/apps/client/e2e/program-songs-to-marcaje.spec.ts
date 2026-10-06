import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A program's songs load into Marcaje from the Programe panel (T-087): in
 * running order, after what is already marked, each song once.
 */

interface Bookmark {
  songId: number
}

async function makeSong(request: APIRequestContext, title: string) {
  const res = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} line`, sortOrder: 0 }] },
  })
  return (await res.json()).data.id as number
}

async function bookmarkedSongIds(request: APIRequestContext) {
  const { data } = await (await request.get('/api/song-bookmarks')).json()
  return (data as Bookmark[]).map((b) => b.songId)
}

test('the panel loads the program songs into Marcaje, each once', async ({
  page,
  request,
}) => {
  const stamp = Date.now()
  const first = await makeSong(request, `E2E Load First ${stamp}`)
  const second = await makeSong(request, `E2E Load Second ${stamp}`)
  const marked = await makeSong(request, `E2E Load Marked ${stamp}`)
  const program = (
    await (
      await request.post('/api/schedules', {
        data: { title: `E2E Load Program ${stamp}` },
      })
    ).json()
  ).data as { id: number }

  try {
    for (const songId of [first, marked, second, first]) {
      await request.post(`/api/schedules/${program.id}/items`, {
        data: { songId },
      })
    }
    await request.delete('/api/song-bookmarks')
    await request.post('/api/song-bookmarks', { data: { songId: marked } })

    await page.addInitScript((id: number) => {
      window.localStorage.setItem('song-detail:schedules-open', 'true')
      window.localStorage.setItem('songPage.selectedScheduleId', String(id))
    }, program.id)
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto(`/songs/${first}`)
    const panel = page.getByTestId('schedule-songs-panel')
    await expect(panel.getByTestId('schedule-song-item')).toHaveCount(4, {
      timeout: 10000,
    })

    const load = panel.getByTestId('schedule-load-into-bookmarks')
    await load.hover()
    await expect(
      page.getByText(/(into Marcaje|în Marcaje)$/).first(),
    ).toBeVisible()
    await load.click()

    // The marked song stays first; the others follow in program order, once.
    await expect
      .poll(() => bookmarkedSongIds(request))
      .toEqual([marked, first, second])
    await expect(page.getByText(/^2 (songs|cântări) /)).toBeVisible()

    // A second click adds nothing.
    await load.click()
    await expect(
      page.getByText(/already in Marcaje|deja în Marcaje/),
    ).toBeVisible()
    expect(await bookmarkedSongIds(request)).toEqual([marked, first, second])
  } finally {
    await request.delete('/api/song-bookmarks')
    await request.delete(`/api/schedules/${program.id}`)
    for (const id of [first, second, marked]) {
      await request.delete(`/api/songs/${id}`)
    }
  }
})
