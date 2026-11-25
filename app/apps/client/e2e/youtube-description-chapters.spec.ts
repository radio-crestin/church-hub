import { type APIRequestContext, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import { type MockObs, startMockObs } from './helpers/mock-obs-websocket'
import {
  CREATED_BROADCAST_ID,
  type MockYouTubeApi,
  startMockYouTubeApi,
} from './helpers/mock-youtube-api'

/**
 * T-032: during a live stream, each song and verse shown becomes a chapter
 * of the YouTube video, and its full text goes under the description. The
 * YouTube API and OBS are local stand-ins; nothing reaches a real channel.
 */

/** YouTube's shortest chapter: what is shown for less is passed over. */
const CHAPTER_MS = 10_500
const VERSES = [
  'Fiindcă atât de mult a iubit Dumnezeu lumea',
  'Dumnezeu, în adevăr, n-a trimis pe Fiul Său în lume ca să judece lumea',
]

let youtube: MockYouTubeApi
let obs: MockObs
let server: ExtraServer
let api: APIRequestContext

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test.beforeAll(async () => {
  test.setTimeout(300_000)
  youtube = await startMockYouTubeApi()
  obs = await startMockObs()
  server = new ExtraServer()
  await server.start({ YOUTUBE_API_ORIGIN: youtube.origin })
  api = await server.adminRequest()
  await server.skipOnboarding(api)
  const tokens = await api.post('/api/livestream/youtube/tokens', {
    data: {
      accessToken: 'e2e-access',
      refreshToken: 'e2e-refresh',
      expiresAt: Date.now() + 24 * 3600 * 1000,
      channelName: 'Biserica Adunare',
    },
  })
  expect(tokens.ok()).toBe(true)
  await api.put('/api/livestream/youtube/config', {
    data: {
      titleTemplate: 'Serviciu divin',
      description: 'Biserica Adunare',
    },
  })
  await api.put('/api/livestream/obs/config', {
    data: { host: '127.0.0.1', port: obs.port, password: '' },
  })
  const connected = await api.post('/api/livestream/obs/connect')
  expect(connected.ok(), await connected.text()).toBe(true)
})

test.afterAll(async () => {
  await api?.dispose()
  await server?.dispose()
  await obs?.close()
  await youtube?.close()
})

function presentVerse(index: number) {
  return api.post('/api/presentation/temporary-bible', {
    data: {
      verseId: 9000 + index,
      reference: `Ioan 3:${16 + index} - VDC`,
      text: VERSES[index],
      translationAbbreviation: 'VDC',
      bookName: 'Ioan',
      translationId: 1,
      bookId: 43,
      bookCode: 'JHN',
      chapter: 3,
      currentVerseIndex: 15 + index,
    },
  })
}

function lastDescription(): string {
  const updates = youtube
    .bodiesOf('PUT', '/youtube/v3/videos')
    .filter((video) => video.id === CREATED_BROADCAST_ID)
  const snippet = updates.at(-1)?.snippet as { description: string }
  return snippet?.description ?? ''
}

test('the description gets a chapter and the text of each song and verse', async () => {
  const songs = (await (await api.get('/api/songs?limit=2')).json()).data
    .songs as { id: number; title: string }[]
  const song = songs[0]
  const full = (await (await api.get(`/api/songs/${song.id}`)).json()).data as {
    slides: { content: string }[]
  }
  const lyric = full.slides[0].content
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) as string

  // The song is on screen as the stream starts: the first chapter, at 0:00.
  await api.post('/api/presentation/temporary-song', {
    data: { songId: song.id },
  })
  const started = await api.post('/api/livestream/obs/stream/start')
  expect(started.ok(), await started.text()).toBe(true)
  await new Promise((resolve) => setTimeout(resolve, CHAPTER_MS))

  // Two verses one after the other: one chapter, Ioan 3:16-17.
  await presentVerse(0)
  await presentVerse(1)
  await new Promise((resolve) => setTimeout(resolve, CHAPTER_MS))

  // A song shown for a moment (passing through) is no chapter.
  await api.post('/api/presentation/temporary-song', {
    data: { songId: songs[1].id },
  })
  await api.post('/api/presentation/clear-temporary')

  const stopped = await api.post('/api/livestream/obs/stream/stop')
  expect(stopped.ok(), await stopped.text()).toBe(true)

  const description = lastDescription()
  test.info().attach('description.txt', { body: description })
  const lines = description.split('\n')
  expect(lines[0]).toBe('Biserica Adunare')
  expect(lines).toContain(`0:00 ${song.title}`)
  expect(lines.filter((line) => /^\d+:\d\d /.test(line))).toEqual([
    `0:00 ${song.title}`,
    expect.stringMatching(/^0:1\d Ioan 3:16-17$/),
  ])
  expect(description).toContain(lyric)
  expect(description).toContain(`16 ${VERSES[0]}\n17 ${VERSES[1]}`)
  expect(description).not.toMatch(/[<>]/)
})

test('the chapters can be turned off on the YouTube settings page', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: server.baseURL,
    storageState: await api.storageState(),
  })
  const page = await context.newPage()
  await page.goto('/livestream/youtube')
  const toggle = page.getByTestId('youtube-description-chapters')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await page.getByTestId('youtube-settings-save').click()
  await expect(page.getByTestId('youtube-settings-save')).toBeDisabled()
  await context.close()

  const config = (
    await (await api.get('/api/livestream/youtube/config')).json()
  ).data as { descriptionChapters: boolean }
  expect(config.descriptionChapters).toBe(false)

  // Off: a new stream leaves the description as it is.
  const before = youtube.requests.length
  await api.post('/api/presentation/temporary-song', {
    data: {
      songId: (await (await api.get('/api/songs?limit=1')).json()).data.songs[0]
        .id,
    },
  })
  expect((await api.post('/api/livestream/obs/stream/start')).ok()).toBe(true)
  await new Promise((resolve) => setTimeout(resolve, CHAPTER_MS))
  expect((await api.post('/api/livestream/obs/stream/stop')).ok()).toBe(true)
  // (Saving the page sent the template's category and tags: written as before.)
  const descriptions = youtube.requests
    .slice(before)
    .filter((r) => r.method === 'PUT' && r.path === '/youtube/v3/videos')
    .map((r) => JSON.parse(r.body).snippet.description as string)
  for (const description of descriptions) {
    expect(description).not.toMatch(/^0:00 /m)
  }
})
