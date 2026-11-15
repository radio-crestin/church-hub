import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * T-140: with the focus in a search field, Down (and Up, PageDown, PageUp)
 * still moves the live slide — the operator keeps the search focused to find
 * what comes next. The field keeps the keys it uses itself: a results list it
 * walks with the arrows, and Left/Right for the caret.
 *
 * Presentation state is a server singleton, so we assert against
 * /api/presentation/state filtered by our song id.
 */

test.describe('Slide keys in a search field', () => {
  // Presentation state is global on the server — keep these serial.
  test.describe.configure({ mode: 'serial' })

  let songId: number

  const slideIndex = async (request: APIRequestContext) => {
    const { data } = await (await request.get('/api/presentation/state')).json()
    const tc = data?.temporaryContent
    return tc?.type === 'song' && tc.data.songId === songId
      ? (tc.data.currentSlideIndex as number)
      : -1
  }

  /** Presents the first slide of the song from its page, with F5. */
  async function presentSong(page: Page, request: APIRequestContext) {
    await page.goto(`/songs/${songId}`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    )
    await page.keyboard.press('F5')
    await expect.poll(() => slideIndex(request), { timeout: 10000 }).toBe(0)
    // Let the client's presentation state catch up (websocket round-trip) so
    // the next key acts on a live presentation.
    await page.waitForTimeout(1500)
  }

  test.beforeEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    const slides = [1, 2, 3].map((n) => ({
      content: `Search keys slide ${n}`,
      type: n === 1 ? 'verse' : 'chorus',
    }))
    const res = await request.post('/api/songs', {
      data: { title: `E2E Search Keys ${Date.now()}`, slides },
    })
    expect(res.status()).toBe(201)
    songId = (await res.json()).data.id
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    await request.delete(`/api/songs/${songId}`).catch(() => {})
  })

  test('Down and Up in the Bible search move the live song', async ({
    page,
    request,
  }) => {
    await presentSong(page, request)

    await page.goto('/bible')
    const search = page.getByPlaceholder(/search|caut/i).first()
    await expect(search).toBeFocused()
    // "Ioan" opens the book's chapters: no verse list to walk.
    await search.pressSequentially('Ioan')
    await expect(
      page.getByRole('button', { name: '21', exact: true }),
    ).toBeVisible({ timeout: 10000 })

    await search.press('ArrowDown')
    await expect.poll(() => slideIndex(request), { timeout: 10000 }).toBe(1)
    await search.press('PageDown')
    await expect.poll(() => slideIndex(request), { timeout: 10000 }).toBe(2)
    await search.press('ArrowUp')
    await expect.poll(() => slideIndex(request), { timeout: 10000 }).toBe(1)

    // Left/Right stay with the caret, and the typed text stays as it was.
    await search.press('ArrowRight')
    await page.waitForTimeout(1000)
    expect(await slideIndex(request)).toBe(1)
    await expect(search).toHaveValue('Ioan')
    await expect(search).toBeFocused()
  })

  test('Down in the Programe search on the song page moves the live song', async ({
    page,
    request,
  }) => {
    const res = await request.post('/api/schedules', {
      data: { title: `E2E Search Keys Prog ${Date.now()}` },
    })
    const scheduleId = (await res.json()).data.id as number

    try {
      await page.addInitScript((id: number) => {
        window.localStorage.setItem('song-detail:schedules-open', 'true')
        window.localStorage.setItem('songPage.selectedScheduleId', String(id))
      }, scheduleId)
      await page.setViewportSize({ width: 1400, height: 900 })
      await presentSong(page, request)

      const panel = page.getByTestId('schedule-songs-panel')
      await panel.getByTestId('schedule-search-toggle').click()
      const search = panel.getByTestId('schedule-search-input')
      await search.fill('E2E')
      await expect(search).toBeFocused()

      await search.press('ArrowDown')
      await expect.poll(() => slideIndex(request), { timeout: 10000 }).toBe(1)
      await search.press('ArrowUp')
      await expect.poll(() => slideIndex(request), { timeout: 10000 }).toBe(0)
    } finally {
      await request.delete(`/api/schedules/${scheduleId}`).catch(() => {})
    }
  })
})
