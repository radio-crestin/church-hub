import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The projection window's own keyboard.
 *
 * On a single monitor the projection is what holds the keyboard once it opens,
 * so it drives navigation itself rather than waiting to be handed back — and
 * two things stood between an operator and that working:
 *
 *   - the window is created and shown by the shell, and on Windows a fresh
 *     WebView2 window is focused without its web content being focused with it,
 *     so nothing reached the document until someone clicked inside it;
 *   - the control window has the F1-F11 browser defaults suppressed by the
 *     shell, but the projection windows never did — a presenter remote's F5
 *     "start" button reloaded the projector mid-service.
 */

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: {
      title,
      slides: [
        { content: 'First slide', sortOrder: 0 },
        { content: 'Second slide', sortOrder: 1 },
        { content: 'Third slide', sortOrder: 2 },
      ],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function liveSlideIndex(
  request: APIRequestContext,
): Promise<number | null> {
  const response = await request.get('/api/presentation/state')
  const { data } = await response.json()
  return data.temporaryContent?.type === 'song'
    ? (data.temporaryContent.data.currentSlideIndex as number)
    : null
}

async function firstScreenId(request: APIRequestContext) {
  const response = await request.get('/api/screens')
  const { data } = await response.json()
  return (data as Array<{ id: number }>)[0]?.id
}

test.describe('The projection window holds its own keyboard', () => {
  test('the page takes the keyboard itself, without waiting for a click', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')

    await page.goto(`/screen/${screenId}`)
    await page.waitForLoadState('networkidle')

    // The projection's own root holds the focus, so a keystroke landing on
    // this window reaches the document rather than the empty native frame.
    await expect(page.getByTestId('screen-renderer-root')).toBeFocused()
  })

  test('arrows drive the slide with nothing on the page ever clicked', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const song = await createSong(request, `E2E Projection Keys ${Date.now()}`)

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id, slideIndex: 0 },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      // Up/Down as well as Left/Right — a remote's rocker sends either pair.
      await page.keyboard.press('ArrowDown')
      await expect
        .poll(() => liveSlideIndex(request), { timeout: 10000 })
        .toBe(1)
      await page.keyboard.press('ArrowUp')
      await expect.poll(() => liveSlideIndex(request)).toBe(0)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('a remote pressing F5 does not reload the projection', async ({
    page,
    request,
  }) => {
    const screenId = await firstScreenId(request)
    test.skip(!screenId, 'no screens configured')
    const song = await createSong(request, `E2E Projection F5 ${Date.now()}`)

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id, slideIndex: 1 },
      })
      await page.goto(`/screen/${screenId}`)
      await page.waitForLoadState('networkidle')

      // A marker only this document has: it does not survive a reload.
      await page.evaluate(() => {
        ;(window as unknown as Record<string, unknown>).__e2eAlive = true
      })

      await page.keyboard.press('F5')
      await page.waitForTimeout(1000)

      expect(
        await page.evaluate(
          () =>
            (window as unknown as Record<string, unknown>).__e2eAlive === true,
        ),
      ).toBe(true)
      // And it is not treated as a navigation key either.
      expect(await liveSlideIndex(request)).toBe(1)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})
