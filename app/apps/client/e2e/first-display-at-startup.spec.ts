import { expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * The first song sent live after the app starts reaches the projector at
 * once. The server used to build the song library's version index in one go
 * right after start-up, holding every request for seconds on a large library
 * (about 4 s on the 26,000 seeded songs): the projection opening with the app
 * stayed black, and the first slide waited behind it (T-139). This restarts a
 * server of its own, as the app starts on a Sunday morning, and sends a song
 * the moment it is ready, while that index is still being built.
 */

/** Show → lyrics on the projection; about 0.9 s now, about 5 s before. */
const FIRST_DISPLAY_BUDGET_MS = 3000
const INDEX_BUILT_LINE = /Library version index: \d+ songs/

test.describe.configure({ mode: 'serial', timeout: 600_000 })

let server: ExtraServer

test.beforeAll(async () => {
  server = new ExtraServer()
  await server.start()
})

test.afterAll(async () => {
  await server?.dispose()
})

test('the first song sent after start-up shows within the budget', async ({
  browser,
}) => {
  // Signed in and set up once, as the desktop app already is when it starts.
  const api = await server.adminRequest()
  const screens = (await (await api.get('/api/screens')).json()).data as {
    id: number
    type: string
  }[]
  const screen = screens.find((s) => s.type === 'primary') ?? screens[0]
  expect(screen, 'a fresh install has a screen').toBeTruthy()
  const songs = (await (await api.get('/api/songs?limit=1')).json()).data
    .songs as { id: number }[]
  const song = (await (await api.get(`/api/songs/${songs[0].id}`)).json())
    .data as { slides: { content: string }[] }
  const lyric = song.slides[0].content
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) as string
  const storageState = await api.storageState()
  await api.dispose()

  await server.stop()
  await server.start()

  const context = await browser.newContext({
    baseURL: server.baseURL,
    storageState,
  })
  const projection = await context.newPage()
  const shownAt = Date.now()
  const [, show] = await Promise.all([
    projection.goto(`/screen/${screen.id}`),
    context.request.post('/api/presentation/temporary-song', {
      data: { songId: songs[0].id, slideIndex: 0 },
    }),
  ])
  expect(show.ok()).toBe(true)
  await expect(
    projection.getByText(lyric).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 30_000 })
  const firstDisplayMs = Date.now() - shownAt

  expect(
    firstDisplayMs,
    `the first slide reached the projection in ${firstDisplayMs} ms`,
  ).toBeLessThan(FIRST_DISPLAY_BUDGET_MS)
  expect(
    server.log,
    'the song was sent while the library index was still being built',
  ).not.toMatch(INDEX_BUILT_LINE)

  // The index is still built in the background, for the "possible versions".
  await expect
    .poll(() => server.log, { timeout: 60_000 })
    .toMatch(INDEX_BUILT_LINE)
  await context.close()
})
