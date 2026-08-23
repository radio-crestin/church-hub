import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Escape must hide what is on the projector, from wherever it is pressed:
 * from the projection window itself (which carries none of the control
 * window's chrome, and is what has focus on a single-monitor setup), and from
 * the song page even when the page is not the one presenting.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: { title, slides: [{ content: `${title} lyrics`, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function isHidden(request: APIRequestContext) {
  const response = await request.get('/api/presentation/state')
  const { data } = await response.json()
  return data.isHidden as boolean
}

test.describe('Escape hides the projection', () => {
  test('from the projection window', async ({ page, request }) => {
    const song = await createSong(request, `E2E Escape Screen ${Date.now()}`)
    const screensResponse = await request.get('/api/screens')
    const { data: screens } = await screensResponse.json()
    const screen = screens[0] as { id: number } | undefined
    test.skip(!screen, 'no screens configured')

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id },
      })
      expect(await isHidden(request)).toBe(false)

      await page.goto(`/screen/${screen?.id}`)
      await page.waitForLoadState('networkidle')
      await page.keyboard.press('Escape')

      await expect.poll(() => isHidden(request), { timeout: 10000 }).toBe(true)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('from a song page that is not the one presenting', async ({
    page,
    request,
  }) => {
    const uniq = Date.now()
    const presented = await createSong(request, `E2E Escape Live ${uniq}`)
    const opened = await createSong(request, `E2E Escape Other ${uniq}`)

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: presented.id },
      })
      expect(await isHidden(request)).toBe(false)

      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${opened.id}`)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('[data-editing]')).toBeVisible({
        timeout: 10000,
      })

      // The page has nothing of its own to hide, so Escape must fall through to
      // the app-wide handler instead of being swallowed.
      await page.keyboard.press('Escape')

      await expect.poll(() => isHidden(request), { timeout: 10000 }).toBe(true)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${presented.id}`).catch(() => {})
      await request.delete(`/api/songs/${opened.id}`).catch(() => {})
    }
  })
})
