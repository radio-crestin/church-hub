import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The factory slide design (T-091): every new screen starts in fonts bundled
 * with the app — the same on macOS, Windows and Linux, with the Romanian
 * diacritics — and its slides draw in them. The presentation state is stubbed
 * in the browser only, so nothing here changes what is live.
 */

const SCREEN_TYPES = ['primary', 'stage', 'livestream', 'kiosk'] as const
const BUNDLED_FONTS = ['Source Sans 3', 'Montserrat']
const LYRIC = 'Cât de mare ești Tu, Doamne, și sfânt'

interface ElementConfig {
  style?: { fontFamily: string }
}

async function createScreen(request: APIRequestContext, type: string) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Design ${type} ${Date.now()}`, type },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

async function readContentConfigs(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/screens/${id}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.contentConfigs as Record<
    string,
    Record<string, ElementConfig | unknown>
  >
}

/** Serves a presentation state with one song slide on screen; writes are refused. */
async function serveSongSlide(page: Page) {
  await page.route('**/api/presentation/**', async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') return route.abort()
    if (!new URL(request.url()).pathname.endsWith('/presentation/state')) {
      return route.continue()
    }
    const response = await route.fetch()
    const body = await response.json()
    body.data = {
      ...body.data,
      currentSongSlideId: null,
      lastSongSlideId: null,
      isPresenting: true,
      isHidden: false,
      slideHighlights: [],
      temporaryContent: {
        type: 'song',
        data: {
          songId: 1,
          title: 'E2E Design Song',
          keyLine: null,
          slides: [
            { id: 1, sortOrder: 0, content: '<p>Prima</p>' },
            { id: 2, sortOrder: 1, content: `<p>${LYRIC}</p>` },
            { id: 3, sortOrder: 2, content: '<p>Ultima</p>' },
          ],
          currentSlideIndex: 1,
        },
      },
      updatedAt: Date.now() + 10 ** 10,
    }
    await route.fulfill({ response, json: body })
  })
}

test.describe('Factory slide design', () => {
  const created: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of created) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  for (const type of SCREEN_TYPES) {
    test(`a new ${type} screen uses only bundled fonts`, async ({
      request,
    }) => {
      const screen = await createScreen(request, type)
      created.push(screen.id)
      const configs = await readContentConfigs(request, screen.id)

      for (const [contentType, config] of Object.entries(configs)) {
        for (const element of Object.values(config)) {
          const font = (element as ElementConfig)?.style?.fontFamily
          if (font === undefined) continue
          expect(BUNDLED_FONTS, `${contentType} font`).toContain(font)
        }
      }
    })
  }

  test('a projected slide draws in the bundled font', async ({
    page,
    request,
  }) => {
    const screen = await createScreen(request, 'primary')
    created.push(screen.id)
    await serveSongSlide(page)

    await page.goto(`/screen/${screen.id}`)
    const lyric = page.getByText(LYRIC).last()
    await expect(lyric).toBeVisible()

    const fontFamily = await lyric.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    )
    expect(fontFamily).toMatch(/^["']Source Sans 3 Variable["']/)

    // The webfont itself is loaded — both the Latin and the Latin Extended
    // (ă ș ț) files — not a system fallback.
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.fonts]
            .filter(
              (face) =>
                face.status === 'loaded' &&
                face.family.includes('Source Sans 3 Variable'),
            )
            .map((face) => face.unicodeRange.split(',')[0].trim()),
        ),
      )
      .toEqual(expect.arrayContaining(['U+0-FF', 'U+100-2BA']))
  })
})
