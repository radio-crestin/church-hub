import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

/**
 * A livestream screen hides the song key (gama) by default.
 *
 * The stream audience reads the lyrics; the key is for the musicians in the
 * room. Other screen types keep showing it.
 */

async function createScreen(
  request: APIRequestContext,
  name: string,
  type: string,
) {
  const response = await request.post('/api/screens', { data: { name, type } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data as { id: number }
}

async function readSongConfig(request: APIRequestContext, id: number) {
  const response = await request.get(`/api/screens/${id}`)
  expect(response.ok()).toBeTruthy()
  const screen = (await response.json()).data as {
    contentConfigs: { song: { displayKeyLine?: boolean } }
  }
  return screen.contentConfigs.song
}

test.describe('Song key line default per screen type', () => {
  const created: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of created) {
      await request.delete(`/api/screens/${id}`).catch(() => {})
    }
  })

  test('a fresh livestream screen hides the gama', async ({ request }) => {
    const screen = await createScreen(
      request,
      `E2E Gama livestream ${Date.now()}`,
      'livestream',
    )
    created.push(screen.id)
    expect((await readSongConfig(request, screen.id)).displayKeyLine).toBe(
      false,
    )
  })

  for (const type of ['primary', 'stage']) {
    test(`a fresh ${type} screen still shows the gama`, async ({ request }) => {
      const screen = await createScreen(
        request,
        `E2E Gama ${type} ${Date.now()}`,
        type,
      )
      created.push(screen.id)
      expect(
        (await readSongConfig(request, screen.id)).displayKeyLine ?? true,
      ).toBe(true)
    })
  }
})

const ROOT = '[data-testid="screen-renderer-root"]'
const SONG_KEY = 'Re Minor'

test.describe('The gama on the projection, first slide', () => {
  let songId: number
  const created: number[] = []
  const suffix = Date.now()
  const firstVerse = `Gama verse one ${suffix}`

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/songs', {
      data: {
        title: `E2E Gama ${suffix}`,
        keyLine: SONG_KEY,
        slides: [firstVerse, `Gama verse two ${suffix}`].map(
          (content, sortOrder) => ({ content, sortOrder }),
        ),
      },
    })
    expect(res.status()).toBe(201)
    songId = (await res.json()).data.id
    const present = await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    expect(present.ok()).toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop')
    for (const id of created) await request.delete(`/api/screens/${id}`)
    if (songId) await request.delete(`/api/songs/${songId}`)
  })

  async function keyOnScreen(page: Page, screenId: number) {
    await page.goto(`/screen/${screenId}`)
    const root = page.locator(ROOT)
    const shown = page.locator(':not([aria-hidden="true"])')
    await expect(
      root.getByText(firstVerse, { exact: true }).and(shown),
    ).toBeVisible({ timeout: 10000 })
    return root.getByText(SONG_KEY, { exact: true }).and(shown)
  }

  test('the seeded stage monitor shows the gama', async ({ page, request }) => {
    const { data } = await (await request.get('/api/screens')).json()
    const stage = (data as { id: number; type: string }[]).find(
      (s) => s.type === 'stage',
    )
    expect(stage, 'a stage screen is seeded').toBeTruthy()
    await expect(await keyOnScreen(page, stage?.id ?? 0)).toBeVisible()
  })

  for (const [type, shown] of [
    ['stage', true],
    ['livestream', false],
  ] as const) {
    test(`a new ${type} screen ${shown ? 'shows' : 'hides'} the gama`, async ({
      page,
      request,
    }) => {
      const screen = await createScreen(
        request,
        `E2E Gama render ${type}`,
        type,
      )
      created.push(screen.id)
      const key = await keyOnScreen(page, screen.id)
      if (shown) await expect(key).toBeVisible()
      else await expect(key).toHaveCount(0)
    })
  }
})
