import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * The clock shows on every screen and on everything presented where the
 * operators enabled it (T-138: «in ultima versiune nu se afiseaza ceasul»).
 * The factory design had turned the projector's idle clock off, and a design
 * saved by an older version kept its clock switch where only the renderer
 * still looked. Each test makes its own screens and removes them.
 */

const SCREEN_TYPES = ['primary', 'stage', 'livestream', 'kiosk'] as const
const TIME_TEXT = /^\d{1,2}:\d{2}(:\d{2})?$/
const LYRIC = 'E2E clock lyric on every screen'
const VERSE = 'E2E clock verse on every screen'

type ContentConfigs = Record<string, Record<string, unknown>>

async function createScreen(request: APIRequestContext, type: string) {
  const response = await request.post('/api/screens', {
    data: { name: `E2E Clock ${type} ${Date.now()}`, type },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

async function readContentConfigs(
  request: APIRequestContext,
  screenId: number,
): Promise<ContentConfigs> {
  const response = await request.get(`/api/screens/${screenId}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.contentConfigs
}

async function saveContentConfig(
  request: APIRequestContext,
  screenId: number,
  contentType: string,
  config: Record<string, unknown>,
) {
  const response = await request.put(
    `/api/screens/${screenId}/config/${contentType}`,
    { data: { config } },
  )
  expect(response.ok()).toBeTruthy()
}

/** The operators' choice: the clock on everything this screen shows. */
async function enableClockEverywhere(
  request: APIRequestContext,
  screenId: number,
) {
  const configs = await readContentConfigs(request, screenId)
  for (const [contentType, config] of Object.entries(configs)) {
    if (contentType === 'screen_share') continue
    await saveContentConfig(request, screenId, contentType, {
      ...config,
      clockEnabled: true,
    })
  }
}

function presentVerse(request: APIRequestContext) {
  return request.post('/api/presentation/temporary-bible', {
    data: {
      verseId: 9138,
      reference: 'Ioan 3:16',
      text: VERSE,
      translationAbbreviation: 'VDC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      bookCode: 'JHN',
      chapter: 3,
      currentVerseIndex: 15,
    },
  })
}

function visibleClock(page: Page) {
  return page.getByText(TIME_TEXT).filter({ visible: true })
}

test.describe('Clock on every screen', () => {
  const screenIds: number[] = []
  const songIds: number[] = []

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary').catch(() => {})
    for (const id of screenIds.splice(0)) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
    for (const id of songIds.splice(0)) {
      await request.delete(`/api/songs/${id}`).catch(() => {})
    }
  })

  test('every screen type shows its clock when idle, with a song, a verse and a scene item', async ({
    context,
    request,
  }) => {
    test.setTimeout(90000)
    const created = await request.post('/api/songs', {
      data: {
        title: `E2E Clock Song ${Date.now()}`,
        slides: [{ content: LYRIC, sortOrder: 0 }],
      },
    })
    expect(created.status()).toBe(201)
    songIds.push(((await created.json()).data as { id: number }).id)

    const pages: Record<string, Page> = {}
    for (const type of SCREEN_TYPES) {
      const { id } = await createScreen(request, type)
      screenIds.push(id)
      await enableClockEverywhere(request, id)
      pages[type] = await context.newPage()
      await pages[type].goto(`/screen/${id}`)
    }

    const expectClockEverywhere = async (state: string) => {
      for (const type of SCREEN_TYPES) {
        await expect(
          visibleClock(pages[type]),
          `${type} screen shows the clock ${state}`,
        ).toHaveCount(1, { timeout: 10000 })
      }
    }

    await request.post('/api/presentation/clear-temporary')
    await expectClockEverywhere('when idle')

    await request.post('/api/presentation/temporary-song', {
      data: { songId: songIds[0] },
    })
    await expect(
      pages.primary.getByText(LYRIC).filter({ visible: true }),
    ).toHaveCount(1, { timeout: 10000 })
    await expectClockEverywhere('with a song')

    expect((await presentVerse(request)).ok()).toBeTruthy()
    await expect(
      pages.primary.getByText(VERSE).filter({ visible: true }),
    ).toHaveCount(1, { timeout: 10000 })
    await expectClockEverywhere('with a Bible verse')

    const scene = await request.post('/api/presentation/temporary-scene', {
      data: { obsSceneName: 'Solo' },
    })
    expect(scene.ok()).toBeTruthy()
    await expect(
      pages.primary.getByText(VERSE).filter({ visible: true }),
    ).toHaveCount(0, { timeout: 10000 })
    await expectClockEverywhere('during a scene item')
  })

  test('a new projector shows the clock between items, not over them', async ({
    page,
    request,
  }) => {
    const { id } = await createScreen(request, 'primary')
    screenIds.push(id)
    const configs = await readContentConfigs(request, id)
    expect(configs.empty.clockEnabled).toBe(true)
    expect(configs.song.clockEnabled).toBe(false)

    await request.post('/api/presentation/clear-temporary')
    await page.goto(`/screen/${id}`)
    await expect(visibleClock(page)).toHaveCount(1, { timeout: 10000 })

    expect((await presentVerse(request)).ok()).toBeTruthy()
    await expect(page.getByText(VERSE).filter({ visible: true })).toHaveCount(
      1,
      { timeout: 10000 },
    )
    await expect(visibleClock(page)).toHaveCount(0)
  })

  test("an older design's clock switch still decides, and the editor reads it", async ({
    page,
    request,
  }) => {
    const { id } = await createScreen(request, 'primary')
    screenIds.push(id)
    const configs = await readContentConfigs(request, id)

    // Saved by an earlier version: the switch under `clock`, none of its own.
    const { clockEnabled: _idle, ...idle } = configs.empty
    await saveContentConfig(request, id, 'empty', {
      ...idle,
      clock: { enabled: false },
    })
    const { clockEnabled: _verse, ...verse } = configs.bible
    await saveContentConfig(request, id, 'bible', {
      ...verse,
      clock: { enabled: true },
    })

    const read = await readContentConfigs(request, id)
    expect(read.empty.clockEnabled).toBe(false)
    expect(read.empty).not.toHaveProperty('clock')
    expect(read.bible.clockEnabled).toBe(true)
    expect(read.bible).not.toHaveProperty('clock')

    await page.goto(`/screen/${id}`)
    expect((await presentVerse(request)).ok()).toBeTruthy()
    await expect(page.getByText(VERSE).filter({ visible: true })).toHaveCount(
      1,
      { timeout: 10000 },
    )
    await expect(visibleClock(page)).toHaveCount(1, { timeout: 10000 })

    await request.post('/api/presentation/clear-temporary')
    await expect(page.getByText(VERSE).filter({ visible: true })).toHaveCount(
      0,
      { timeout: 10000 },
    )
    await expect(visibleClock(page)).toHaveCount(0)
  })
})
