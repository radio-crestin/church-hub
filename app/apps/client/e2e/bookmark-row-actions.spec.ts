import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The two buttons a Marcaje row carries, matching the Programe column:
 * a pencil that opens the song editor, and a monitor button that projects the
 * song on its own. Clicking the row itself still only walks to the song.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

async function cleanup(
  request: APIRequestContext,
  songs: Array<{ id: number }>,
) {
  await request.post('/api/presentation/clear-temporary').catch(() => {})
  const response = await request.get('/api/song-bookmarks')
  const bookmarks = (await response.json()).data as Array<{
    id: number
    songId: number
  }>
  for (const bookmark of bookmarks) {
    if (songs.some((song) => song.id === bookmark.songId)) {
      await request.delete(`/api/song-bookmarks/${bookmark.id}`).catch(() => {})
    }
  }
  for (const song of songs) {
    await request.delete(`/api/songs/${song.id}`).catch(() => {})
  }
}

test.describe('Marcaje row actions', () => {
  test('the monitor button projects the song and the pencil opens its editor', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    // Two songs: the page shows one, the row under test is the other, so
    // projecting is unambiguous.
    const onScreen = await createSong(request, `E2E Row Host ${uniq}`)
    const marked = await createSong(request, `E2E Row Marked ${uniq}`)

    try {
      await request.post('/api/song-bookmarks', { data: { songId: marked.id } })
      await request.post('/api/presentation/clear-temporary')

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/songs/${onScreen.id}`)
      await page.waitForLoadState('networkidle')

      const row = page
        .getByTestId('bookmark-item')
        .filter({ hasText: `E2E Row Marked ${uniq}` })
      await expect(row).toBeVisible({ timeout: 10000 })

      // The monitor button puts the song up on its own — no program context.
      await row.getByTestId('bookmark-song-present').click()
      await expect
        .poll(
          async () => {
            const state = await request.get('/api/presentation/state')
            const { data } = await state.json()
            return data?.temporaryContent?.data?.songId
          },
          { timeout: 10000 },
        )
        .toBe(marked.id)

      // The pencil opens the same editor the Programe column opens.
      await row.getByTestId('bookmark-song-edit').click()
      await expect(page.getByTestId('song-editor-modal')).toBeVisible({
        timeout: 10000,
      })
    } finally {
      await cleanup(request, [onScreen, marked])
    }
  })

  test('projecting from the song list walks the list to that song', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const marked = await createSong(request, `E2E Row List ${uniq}`)

    try {
      await request.post('/api/song-bookmarks', { data: { songId: marked.id } })
      await request.post('/api/presentation/clear-temporary')

      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/songs')
      await page.waitForLoadState('networkidle')

      const row = page
        .getByTestId('bookmark-item')
        .filter({ hasText: `E2E Row List ${uniq}` })
      await expect(row).toBeVisible({ timeout: 10000 })

      await row.getByTestId('bookmark-song-present').click()
      await expect(page).toHaveURL(new RegExp(`/songs/${marked.id}`), {
        timeout: 10000,
      })
    } finally {
      await cleanup(request, [marked])
    }
  })
})
