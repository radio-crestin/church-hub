import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * After "Present" the keyboard has to keep working without a click: the slide
 * that is live takes focus in the control window, and the projection window
 * — which is what has the keyboard on a single monitor — drives the same
 * navigation with the arrow / presenter-remote keys itself.
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

test.describe('Keyboard stays live after presenting', () => {
  test('PowerPoint layout: Present focuses the live thumbnail; projecting a slide does too', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Focus Stage ${Date.now()}`)
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')
      const thumbs = page.getByTestId('stage-thumbnail')
      await expect(thumbs).toHaveCount(3, { timeout: 10000 })

      await page.getByTestId('stage-present').click()
      await expect(page.getByTestId('stage-hide')).toBeVisible({
        timeout: 10000,
      })
      // The button that was clicked no longer holds the keyboard — the live
      // slide's thumbnail does.
      await expect(thumbs.nth(0)).toBeFocused()

      await page.keyboard.press('ArrowRight')
      await expect.poll(() => liveSlideIndex(request)).toBe(1)
      await expect(thumbs.nth(1)).toBeFocused()

      // Projecting a slide with its own button (not "Present") hands the
      // keyboard over as well.
      await page.getByTestId('stage-hide').click()
      await expect.poll(() => liveSlideIndex(request)).toBeNull()
      const project = page.getByTestId('thumb-project').nth(2)
      await project.click()
      await expect.poll(() => liveSlideIndex(request)).toBe(2)
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(3)
      await expect(
        page.locator('[data-testid="stage-thumbnail"]:focus'),
      ).toHaveCount(1)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('classic layout: clicking a slide focuses the live slide', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Focus Classic ${Date.now()}`)
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'normal')
      })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('song-slide-0')).toBeVisible({
        timeout: 10000,
      })

      await page.getByTestId('song-slide-1').click()
      await expect.poll(() => liveSlideIndex(request)).toBe(1)
      // Wait for the page to see it live, or the arrow below would move the
      // local selection instead of the projection.
      await expect(page.getByTestId('song-slide-1')).toHaveAttribute(
        'aria-current',
        'true',
      )
      await expect(page.getByTestId('song-slide-1')).toBeFocused()

      await page.keyboard.press('ArrowRight')
      await expect.poll(() => liveSlideIndex(request)).toBe(2)
      await expect(page.getByTestId('song-slide-2')).toBeFocused()
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the projection window navigates with arrows and remote keys', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Focus Screen ${Date.now()}`)
    const screensResponse = await request.get('/api/screens')
    const { data: screens } = await screensResponse.json()
    const screen = screens[0] as { id: number } | undefined
    test.skip(!screen, 'no screens configured')

    try {
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id, slideIndex: 0 },
      })
      await page.goto(`/screen/${screen?.id}`)
      await page.waitForLoadState('networkidle')

      await page.keyboard.press('ArrowRight')
      await expect
        .poll(() => liveSlideIndex(request), { timeout: 10000 })
        .toBe(1)
      await page.keyboard.press('PageDown')
      await expect.poll(() => liveSlideIndex(request)).toBe(2)
      await page.keyboard.press('ArrowLeft')
      await expect.poll(() => liveSlideIndex(request)).toBe(1)
      await page.keyboard.press('PageUp')
      await expect.poll(() => liveSlideIndex(request)).toBe(0)
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})
