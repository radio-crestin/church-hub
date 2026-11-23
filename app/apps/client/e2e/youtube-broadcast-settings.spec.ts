import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import {
  CREATED_BROADCAST_ID,
  type MockYouTubeApi,
  startMockYouTubeApi,
} from './helpers/mock-youtube-api'

/**
 * T-160: the Live Stream page opens each setup on its own page, and every
 * YouTube setting reaches the broadcast Church Hub creates: the template
 * from a past stream (the latest by default), DVR off, and the rest. The
 * YouTube API is a local stand-in; nothing reaches the church's channel.
 */

let youtube: MockYouTubeApi
let server: ExtraServer
let api: APIRequestContext
let context: BrowserContext
let page: Page

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test.beforeAll(async ({ browser }) => {
  // A hook keeps the default 30 s unless set here; the extra server boots slower on a busy machine.
  test.setTimeout(300_000)
  youtube = await startMockYouTubeApi()
  server = new ExtraServer()
  await server.start({ YOUTUBE_API_ORIGIN: youtube.origin })
  api = await server.adminRequest()
  const tokens = await api.post('/api/livestream/youtube/tokens', {
    data: {
      accessToken: 'e2e-access',
      refreshToken: 'e2e-refresh',
      expiresAt: Date.now() + 24 * 3600 * 1000,
      channelName: 'Biserica Adunare',
    },
  })
  expect(tokens.ok()).toBe(true)

  context = await browser.newContext({
    baseURL: server.baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const users = (await (
    await context.request.get('/api/auth/local-users')
  ).json()) as { data: { id: number; isSuperAdmin: boolean }[] }
  const admin = users.data.find((u) => u.isSuperAdmin)
  await context.request.post('/api/auth/login', { data: { userId: admin?.id } })
  page = await context.newPage()
})

test.afterAll(async () => {
  await context?.close()
  await api?.dispose()
  await server?.dispose()
  await youtube?.close()
})

/** Today as the past stream's title wrote its date (16.11.2025). */
function todayDotted(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
}

test('the Live Stream page has a button for each settings page', async () => {
  await page.goto('/livestream')
  const pages = [
    ['livestream-youtube-settings', /\/livestream\/youtube$/],
    ['livestream-obs-settings', /\/livestream\/obs$/],
    ['livestream-mixer-settings', /\/livestream\/mixer$/],
    ['livestream-scene-settings', /\/settings\/livestream$/],
  ] as const
  await expect(page.getByTestId('livestream-youtube-settings')).toContainText(
    'Biserica Adunare',
  )
  for (const [testId, url] of pages) {
    await page.getByTestId(testId).click()
    await expect(page).toHaveURL(url)
    await page.goto('/livestream')
  }

  await page.getByTestId('livestream-obs-settings').click()
  await expect(page.getByTestId('obs-settings-access')).toBeVisible()
  await page
    .getByRole('link', {
      name: /^(Back to Live Stream|Înapoi la Live Stream)$/,
    })
    .click()
  await expect(page).toHaveURL(/\/livestream$/)
})

test('the YouTube settings start from the latest stream and are all sent', async () => {
  await page.goto('/livestream/youtube')

  // Never set up: the latest past stream fills the page.
  await expect(page.getByTestId('youtube-template-latest-hint')).toBeVisible()
  await expect(page.getByTestId('youtube-title')).toHaveValue(
    'Serviciu divin 16.11.2025',
  )
  await expect(page.getByTestId('youtube-privacy')).toHaveValue('public')
  await expect(page.getByTestId('youtube-latency')).toHaveValue('low')
  await expect(page.getByTestId('youtube-tags')).toHaveValue(
    'biserica, predica',
  )
  await expect(page.getByTestId('youtube-thumbnail')).toHaveAttribute(
    'src',
    `${youtube.origin}/thumbs/past-sunday-maxres.jpg`,
  )
  // DVR is off unless the operator turns it on.
  await expect(page.getByTestId('youtube-dvr')).toHaveAttribute(
    'aria-checked',
    'false',
  )
  // What the API can't set is explained, with where to set it.
  await expect(page.getByTestId('youtube-settings-chat')).toContainText(
    /Subscribers/,
  )

  // The operator changes a few settings, then saves.
  await page.getByTestId('youtube-latency').selectOption('ultraLow')
  await page.getByTestId('youtube-auto-stop').click()
  await page.getByTestId('youtube-tags').fill('biserica, predica, live')
  await page.getByTestId('youtube-tags').blur()
  await page.getByTestId('youtube-playlist').click()
  await page
    .getByTestId('youtube-playlist-option')
    .filter({ hasText: 'Duminici' })
    .click()
  await page.getByTestId('youtube-settings-save').click()
  await expect(page.getByTestId('youtube-settings-save')).toBeDisabled()

  const created = await api.post('/api/livestream/youtube/broadcast')
  expect(created.status()).toBe(201)

  const [insert] = youtube.bodiesOf('POST', '/youtube/v3/liveBroadcasts')
  expect(insert).toMatchObject({
    snippet: {
      title: `Serviciu divin ${todayDotted()}`,
      description: 'Biserica Baptistă Adunare: serviciul de duminică.',
    },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    contentDetails: {
      enableDvr: false,
      enableAutoStart: true,
      enableAutoStop: false,
      latencyPreference: 'ultraLow',
    },
  })

  const bind = youtube.requests.find(
    (r) => r.path === '/youtube/v3/liveBroadcasts/bind',
  )
  expect(bind?.query.get('streamId')).toBe('key-main')
  expect(bind?.query.get('id')).toBe(CREATED_BROADCAST_ID)

  const [video] = youtube.bodiesOf('PUT', '/youtube/v3/videos')
  expect(video).toMatchObject({
    id: CREATED_BROADCAST_ID,
    snippet: {
      title: `Serviciu divin ${todayDotted()}`,
      categoryId: '29',
      tags: ['biserica', 'predica', 'live'],
    },
  })

  const thumbnail = youtube.requests.find(
    (r) => r.path === '/upload/youtube/v3/thumbnails/set',
  )
  expect(thumbnail?.query.get('videoId')).toBe(CREATED_BROADCAST_ID)
  expect(thumbnail?.contentType).toBe('image/jpeg')

  const [playlistItem] = youtube.bodiesOf('POST', '/youtube/v3/playlistItems')
  expect(playlistItem).toMatchObject({
    snippet: {
      playlistId: 'pl-sundays',
      resourceId: { videoId: CREATED_BROADCAST_ID },
    },
  })
})

test('another past stream as the template, and DVR when turned on', async () => {
  youtube.requests.length = 0
  await page.goto('/livestream/youtube')
  await expect(page.getByTestId('youtube-template-latest-hint')).toBeHidden()

  await page.getByTestId('youtube-template-picker').click()
  await page
    .getByTestId('youtube-template-picker-option')
    .filter({ hasText: 'Rugăciune' })
    .click()
  await expect(page.getByTestId('youtube-title')).toHaveValue(
    'Rugăciune 12 noiembrie 2025',
  )
  await expect(page.getByTestId('youtube-privacy')).toHaveValue('unlisted')
  await page.getByTestId('youtube-dvr').click()
  await page.getByTestId('youtube-made-for-kids').click()
  await page.getByTestId('youtube-settings-save').click()
  await expect(page.getByTestId('youtube-settings-save')).toBeDisabled()

  expect((await api.post('/api/livestream/youtube/broadcast')).status()).toBe(
    201,
  )
  const [insert] = youtube.bodiesOf('POST', '/youtube/v3/liveBroadcasts')
  const months = [
    'ianuarie',
    'februarie',
    'martie',
    'aprilie',
    'mai',
    'iunie',
    'iulie',
    'august',
    'septembrie',
    'octombrie',
    'noiembrie',
    'decembrie',
  ]
  const now = new Date()
  expect(insert).toMatchObject({
    snippet: {
      title: `Rugăciune ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
      description: 'Seara de rugăciune.',
    },
    status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: true },
    contentDetails: { enableDvr: true, latencyPreference: 'normal' },
  })
  const [video] = youtube.bodiesOf('PUT', '/youtube/v3/videos')
  expect(video).toMatchObject({
    snippet: { categoryId: '22', tags: ['rugaciune'] },
  })
})
