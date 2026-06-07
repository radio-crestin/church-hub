import { expect, test } from '@playwright/test'

/**
 * Presenter-remote (clicker) flow. Remotes emit plain keyboard events:
 *   F5 = present/start, PageDown = forward, PageUp = back, "b"/"." = black.
 *
 * Desired behaviour:
 *  - Not presenting + F5 → present the currently-focused slide.
 *  - Forward advances; advancing past the last slide CLOSES the presentation.
 *  - Back goes to the first slide and never closes (even if pressed again).
 *  - The black button CLOSES the presentation.
 *
 * Presentation state is a server singleton, so we assert against
 * /api/presentation/state filtered by our song id.
 */

interface SongTemp {
  songId: number
  currentSlideIndex: number
}

test.describe('Presenter remote', () => {
  // Presentation state is global on the server — keep these serial.
  test.describe.configure({ mode: 'serial' })

  async function makeSong(
    request: import('@playwright/test').APIRequestContext,
    title: string,
    slideCount: number,
  ): Promise<number> {
    const slides = Array.from({ length: slideCount }, (_, i) => ({
      content: `${title} slide ${i + 1}`,
      type: i === 0 ? 'verse' : 'chorus',
    }))
    const res = await request.post('/api/songs', { data: { title, slides } })
    expect([201, 409]).toContain(res.status())
    return (await res.json()).data.id as number
  }

  test('F5 presents focused; forward advances and hides past last; black hides like Escape', async ({
    page,
    request,
  }) => {
    const songId = await makeSong(request, `E2E Remote ${Date.now()}`, 2)

    const rawState = async () =>
      (await (await request.get('/api/presentation/state')).json()).data
    const songTemp = async (): Promise<SongTemp | null> => {
      const data = await rawState()
      const tc = data?.temporaryContent
      return tc?.type === 'song' && tc.data.songId === songId ? tc.data : null
    }
    const slideIndex = async () => (await songTemp())?.currentSlideIndex ?? -1

    try {
      await page.goto(`/songs/${songId}`)
      await page.waitForLoadState('networkidle')
      // Ensure no input holds focus so keys reach the global handler.
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      )

      // Present button (F5) → present the focused slide (index 0).
      await page.keyboard.press('F5')
      await expect.poll(slideIndex, { timeout: 10000 }).toBe(0)
      // Let the client's presentation state catch up (websocket round-trip) so
      // the next key acts on a live presentation.
      await page.waitForTimeout(1500)

      // Forward (PageDown) → next slide.
      await page.keyboard.press('PageDown')
      await expect.poll(slideIndex, { timeout: 10000 }).toBe(1)

      // Forward past the last slide → presentation is hidden (content cleared).
      await page.keyboard.press('PageDown')
      await expect.poll(songTemp, { timeout: 10000 }).toBeNull()
      await page.waitForTimeout(1500)

      // Present again, then the black button ("b") hides it like Escape:
      // isHidden becomes true but the temporary content is kept (restorable).
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      )
      await page.keyboard.press('F5')
      await expect.poll(slideIndex, { timeout: 10000 }).toBe(0)
      await page.waitForTimeout(1500)

      await page.keyboard.press('b')
      await expect
        .poll(async () => (await rawState())?.isHidden, { timeout: 10000 })
        .toBe(true)
      // Content is kept (Escape-style blank, not a full close).
      expect(await songTemp()).not.toBeNull()
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => {})
    }
  })

  test('back stops at the first slide and never closes', async ({
    page,
    request,
  }) => {
    const songId = await makeSong(request, `E2E Remote Back ${Date.now()}`, 2)

    const songTemp = async (): Promise<SongTemp | null> => {
      const { data } = await (
        await request.get('/api/presentation/state')
      ).json()
      const tc = data?.temporaryContent
      return tc?.type === 'song' && tc.data.songId === songId ? tc.data : null
    }
    const slideIndex = async () => (await songTemp())?.currentSlideIndex ?? -1

    try {
      await page.goto(`/songs/${songId}`)
      await page.waitForLoadState('networkidle')
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      )

      await page.keyboard.press('F5')
      await expect.poll(slideIndex, { timeout: 10000 }).toBe(0)
      await page.waitForTimeout(1500)
      await page.keyboard.press('PageDown')
      await expect.poll(slideIndex, { timeout: 10000 }).toBe(1)

      // Back → first slide.
      await page.keyboard.press('PageUp')
      await expect.poll(slideIndex, { timeout: 10000 }).toBe(0)

      // Back again at the first slide → stays at 0, does NOT close.
      await page.keyboard.press('PageUp')
      await page.waitForTimeout(1000)
      expect(await slideIndex()).toBe(0)
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => {})
    }
  })
})
