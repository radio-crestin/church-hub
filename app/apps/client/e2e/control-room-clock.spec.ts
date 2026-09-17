import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The Control Room keeps a large Times New Roman clock in its preview whatever
 * the preview screen's clock settings are — also where the operators hid the
 * clock on the screen — and shows only that one. Every other preview still
 * mirrors the screen's own clock. The screen settings are rewritten in the
 * browser only, so nothing here changes the real screens or presents anything.
 */

const CONTROL_ROOM_CLOCK_SIZE = 140
const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/

type ScreenClock = 'hidden' | 'visible'

interface PreviewScreen {
  id: number
  type: string
  isPreviewScreen: boolean
  sortOrder: number
  width: number
}

/** Same choice LivePreview makes: the flagged preview screen, else the first primary. */
async function getPreviewScreen(
  request: APIRequestContext,
): Promise<PreviewScreen> {
  const response = await request.get('/api/screens')
  expect(response.ok()).toBeTruthy()
  const screens: PreviewScreen[] = (await response.json()).data
  const screen =
    screens.find((s) => s.isPreviewScreen) ??
    screens
      .filter((s) => s.type === 'primary')
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  expect(screen, 'a preview screen exists').toBeTruthy()
  return screen
}

/**
 * Serves the preview screen with its clock either hidden or shown in a small
 * system-ui style. Either way the clock is enabled for every content type, so
 * whatever the server happens to be presenting, only the clock settings decide
 * what the preview shows.
 */
async function serveScreenClock(
  page: Page,
  screenId: number,
  clock: ScreenClock,
) {
  await page.route(`**/api/screens/${screenId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const body = await response.json()
    const screen = body.data
    const clockConfig = screen.globalSettings.clockConfig
    screen.globalSettings.clockConfig = {
      ...clockConfig,
      hidden: clock === 'hidden',
      style: {
        ...clockConfig.style,
        fontFamily: 'system-ui',
        maxFontSize: 32,
      },
    }
    for (const config of Object.values(
      screen.contentConfigs as Record<string, { clockEnabled?: boolean }>,
    )) {
      config.clockEnabled = true
    }
    await route.fulfill({ response, json: body })
  })
}

/** Every clock drawn in the live preview, with its rendered font. */
async function readPreviewClocks(page: Page) {
  const preview = page.getByTestId('live-preview')
  await expect(preview).toBeVisible({ timeout: 15000 })
  return preview.evaluate((element, timePattern) => {
    const time = new RegExp(timePattern)
    const box = element.getBoundingClientRect()
    return (
      [...element.querySelectorAll<HTMLElement>('div')]
        // The renderer keeps a hidden copy of each text to measure it.
        .filter(
          (node) =>
            node.children.length === 0 &&
            node.getAttribute('aria-hidden') !== 'true' &&
            time.test(node.textContent?.trim() ?? ''),
        )
        .map((node) => {
          const style = getComputedStyle(node)
          const text = document.createRange()
          text.selectNodeContents(node)
          const bounds = text.getBoundingClientRect()
          return {
            fontFamily: style.fontFamily,
            fontSize: Number.parseFloat(style.fontSize),
            previewWidth: box.width,
            insidePreview:
              bounds.left >= box.left - 1 &&
              bounds.top >= box.top - 1 &&
              bounds.right <= box.right + 1 &&
              bounds.bottom <= box.bottom + 1,
          }
        })
    )
  }, TIME_TEXT.source)
}

test.describe('Control Room clock', () => {
  for (const clock of ['hidden', 'visible'] as const) {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      test(`shows one large Times New Roman clock when the screen's clock is ${clock} at ${viewport.width}x${viewport.height}`, async ({
        page,
        request,
      }) => {
        await page.setViewportSize(viewport)
        const screen = await getPreviewScreen(request)
        await serveScreenClock(page, screen.id, clock)

        await page.goto('/present')

        await expect
          .poll(async () => (await readPreviewClocks(page)).length, {
            timeout: 10000,
          })
          .toBe(1)
        const [previewClock] = await readPreviewClocks(page)

        expect(previewClock.fontFamily).toMatch(/^"?Times New Roman"?,/)
        expect(previewClock.fontFamily).toContain('Liberation Serif')
        expect(previewClock.insidePreview).toBe(true)

        // 140px on the screen, scaled to the preview like the rest of the
        // slide. The fit settles on whole pixels, well within 5%.
        await expect
          .poll(
            async () => {
              const [current] = await readPreviewClocks(page)
              const scale = current.previewWidth / screen.width
              return Math.abs(
                current.fontSize / (CONTROL_ROOM_CLOCK_SIZE * scale) - 1,
              )
            },
            { timeout: 10000 },
          )
          .toBeLessThan(0.05)
      })
    }
  }
})

test.describe('Song page preview clock', () => {
  let songId: number
  let createdSongId: number | null = null

  // Any song will do, as the page is only looked at; one is created only when
  // the library is empty, as it is on a freshly seeded test database.
  test.beforeAll(async ({ request }) => {
    const listed = await request.get('/api/songs?limit=1')
    expect(listed.ok()).toBeTruthy()
    const [existing] = (await listed.json()).data.songs as { id: number }[]
    if (existing) {
      songId = existing.id
      return
    }
    const created = await request.post('/api/songs', {
      data: {
        title: `E2E Preview Clock ${Date.now()}`,
        slides: [{ content: 'Verse one', sortOrder: 0 }],
      },
    })
    expect(created.status()).toBe(201)
    createdSongId = (await created.json()).data.id as number
    songId = createdSongId
  })

  test.afterAll(async ({ request }) => {
    if (createdSongId !== null) {
      await request.delete(`/api/songs/${createdSongId}`)
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    // The control panel with the live preview belongs to the normal layout.
    await page.addInitScript(() => {
      window.localStorage.setItem('song-editor-layout', 'normal')
    })
  })

  test("keeps the screen's clock hidden", async ({ page, request }) => {
    const screen = await getPreviewScreen(request)
    await serveScreenClock(page, screen.id, 'hidden')

    await page.goto(`/songs/${songId}`)
    await expect(page.getByTestId('live-preview')).toBeVisible({
      timeout: 15000,
    })
    // Give a clock that should not be there the time to show up.
    await page.waitForTimeout(1000)

    expect(await readPreviewClocks(page)).toEqual([])
  })

  test("shows the screen's clock in its own style", async ({
    page,
    request,
  }) => {
    const screen = await getPreviewScreen(request)
    await serveScreenClock(page, screen.id, 'visible')

    await page.goto(`/songs/${songId}`)

    await expect
      .poll(async () => (await readPreviewClocks(page)).length, {
        timeout: 10000,
      })
      .toBe(1)
    const [previewClock] = await readPreviewClocks(page)

    expect(previewClock.fontFamily).toMatch(/^system-ui,/)
    const controlRoomSize =
      CONTROL_ROOM_CLOCK_SIZE * (previewClock.previewWidth / screen.width)
    expect(previewClock.fontSize).toBeLessThan(controlRoomSize / 2)
  })
})
