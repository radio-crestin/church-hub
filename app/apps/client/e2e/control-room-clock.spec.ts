import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The Control Room keeps a large bold Times New Roman clock in its preview
 * whatever the preview screen's clock settings are — also where the operators
 * hid the clock on the screen — and shows only that one. Text on screen is
 * drawn over it, and it fades while there is any. Every other preview still
 * mirrors the screen's own clock. The screen settings and the presentation
 * state are rewritten in the browser only, so nothing here changes the real
 * screens or what is live.
 */

const CONTROL_ROOM_CLOCK_SIZE = 140
const CLOCK_BEHIND_TEXT_OPACITY = 0.35
const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/
const LYRIC = 'E2E lyric that runs across the whole screen'

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
 * what the preview shows. `lyricsFillScreen` stretches the lyrics over the
 * whole screen, so they are certain to cross the clock.
 */
async function serveScreenClock(
  page: Page,
  screenId: number,
  clock: ScreenClock,
  { lyricsFillScreen = false } = {},
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
      screen.contentConfigs as Record<
        string,
        { clockEnabled?: boolean; mainText?: { constraints: unknown } }
      >,
    )) {
      config.clockEnabled = true
      if (lyricsFillScreen && config.mainText) {
        const edge = { enabled: true, value: 0, unit: '%' }
        config.mainText.constraints = {
          top: edge,
          right: edge,
          bottom: edge,
          left: edge,
        }
      }
    }
    await route.fulfill({ response, json: body })
  })
}

/**
 * Serves a presentation state with a song slide on screen, or with nothing on
 * it. Writes are refused: the slide change this fakes would otherwise have the
 * page clear the live highlights.
 */
async function servePresentation(page: Page, onScreen: 'song' | 'nothing') {
  await page.route('**/api/presentation/**', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') return route.abort()
    if (!new URL(request.url()).pathname.endsWith('/presentation/state')) {
      return route.continue()
    }
    const response = await route.fetch()
    const body = await response.json()
    const song = onScreen === 'song'
    body.data = {
      ...body.data,
      currentSongSlideId: null,
      lastSongSlideId: null,
      isPresenting: song,
      isHidden: !song,
      slideHighlights: [],
      temporaryContent: song
        ? {
            type: 'song',
            data: {
              songId: 1,
              title: 'E2E Clock Song',
              slides: [
                {
                  id: 1,
                  sortOrder: 0,
                  content: Array(4).fill(LYRIC).join('\n'),
                },
              ],
              currentSlideIndex: 0,
            },
          }
        : null,
      // Newer than anything the server broadcasts, so the live state the
      // WebSocket sends never replaces this one.
      updatedAt: Date.now() + 10 ** 10,
    }
    await route.fulfill({ response, json: body })
  })
}

/** Every clock drawn in the live preview, with its rendered font and opacity. */
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
          let opacity = 1
          for (
            let layer: HTMLElement | null = node;
            layer && layer !== element;
            layer = layer.parentElement
          ) {
            opacity *= Number(getComputedStyle(layer).opacity)
          }
          return {
            fontFamily: style.fontFamily,
            fontSize: Number.parseFloat(style.fontSize),
            fontWeight: Number(style.fontWeight),
            opacity,
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
        expect(previewClock.fontWeight).toBeGreaterThanOrEqual(700)
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

  test('sits behind the lyrics and fades while a song slide is on screen', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const screen = await getPreviewScreen(request)
    await serveScreenClock(page, screen.id, 'hidden', {
      lyricsFillScreen: true,
    })
    await servePresentation(page, 'song')

    await page.goto('/present')

    await expect
      .poll(async () => (await readPreviewClocks(page))[0]?.opacity, {
        timeout: 10000,
      })
      .toBeCloseTo(CLOCK_BEHIND_TEXT_OPACITY, 2)

    // Where the lyrics cross the clock, the lyrics are what is on top.
    await expect
      .poll(
        () =>
          page.getByTestId('live-preview').evaluate(
            (element, { lyric, timePattern }) => {
              const time = new RegExp(timePattern)
              const divs = [...element.querySelectorAll<HTMLElement>('div')]
              // Each text keeps a hidden measuring copy inside its own layer.
              const layerOf = (matches: (text: string) => boolean) =>
                divs.find(
                  (node) =>
                    node.getAttribute('aria-hidden') === 'true' &&
                    matches(node.textContent?.trim() ?? ''),
                )?.parentElement
              const lyricLayer = layerOf((text) => text.includes(lyric))
              const clockLayer = layerOf((text) => time.test(text))
              if (!lyricLayer || !clockLayer) return 'layers not drawn yet'

              const clock = clockLayer.getBoundingClientRect()
              const hit = document.elementFromPoint(
                clock.right - clock.height / 2,
                clock.top + clock.height / 2,
              )
              if (clockLayer.contains(hit)) return 'clock'
              return lyricLayer.contains(hit) ? 'lyrics' : 'something else'
            },
            { lyric: LYRIC, timePattern: TIME_TEXT.source },
          ),
        { timeout: 10000 },
      )
      .toBe('lyrics')
  })

  test('stays solid with nothing on screen', async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const screen = await getPreviewScreen(request)
    await serveScreenClock(page, screen.id, 'hidden')
    await servePresentation(page, 'nothing')

    await page.goto('/present')

    await expect
      .poll(async () => (await readPreviewClocks(page))[0]?.opacity, {
        timeout: 10000,
      })
      .toBe(1)
  })
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
