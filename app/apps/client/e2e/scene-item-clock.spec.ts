import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A program's scene item (e.g. "Solo") switches OBS and puts an empty slide
 * on the projector. That empty slide is the idle screen, so it keeps the
 * clock the operators enabled for it (T-023: the clock vanished instead).
 */

const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/
const SONG_TEXT = 'E2E scene clock lyric'

async function getProjectorId(request: APIRequestContext): Promise<number> {
  const response = await request.get('/api/screens')
  const screens: { id: number; type: string }[] = (await response.json()).data
  const projector = screens.find((s) => s.type === 'primary') ?? screens[0]
  expect(projector, 'a screen exists').toBeTruthy()
  return projector.id
}

/** Clock shown on the empty slide only, set in the browser so no real screen changes. */
async function serveClockOnEmptySlideOnly(page: Page, screenId: number) {
  await page.route(`**/api/screens/${screenId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const body = await response.json()
    const screen = body.data
    screen.globalSettings.clockConfig.hidden = false
    for (const [contentType, config] of Object.entries(
      screen.contentConfigs as Record<string, { clockEnabled?: boolean }>,
    )) {
      config.clockEnabled = contentType === 'empty'
    }
    await route.fulfill({ response, json: body })
  })
}

test.describe('Scene items on the projector', () => {
  test('a scene item shows the empty slide with its clock', async ({
    page,
    request,
  }) => {
    const created = await request.post('/api/songs', {
      data: {
        title: `E2E Scene Clock ${Date.now()}`,
        slides: [{ content: SONG_TEXT, sortOrder: 0 }],
      },
    })
    expect(created.status()).toBe(201)
    const song = (await created.json()).data as { id: number }
    const screenId = await getProjectorId(request)

    const lyric = page.getByText(SONG_TEXT).filter({ visible: true })
    const clock = page.getByText(TIME_TEXT).filter({ visible: true })

    try {
      await serveClockOnEmptySlideOnly(page, screenId)
      await request.post('/api/presentation/temporary-song', {
        data: { songId: song.id },
      })
      await page.goto(`/screen/${screenId}`)
      await expect(lyric).toHaveCount(1, { timeout: 10000 })
      await expect(clock).toHaveCount(0)

      const scene = await request.post('/api/presentation/temporary-scene', {
        data: { obsSceneName: 'Solo' },
      })
      expect(scene.ok()).toBeTruthy()

      await expect(lyric).toHaveCount(0, { timeout: 10000 })
      await expect(clock).toHaveCount(1, { timeout: 10000 })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})
