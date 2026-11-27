import { readFileSync } from 'node:fs'
import {
  type APIRequestContext,
  type BrowserContext,
  devices,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

import {
  JPEG_FIXTURE,
  MEDIA_API,
  uploadMedia,
  WEBM_FIXTURE,
} from './helpers/background-media'
import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { relayToService } from './helpers/relay-to-service'
import { SYNC_BUCKET, SyncService } from './helpers/sync-service'
import { findSong, pageApi, waitForApp } from './helpers/web-app'

/**
 * Media stored on the church PC on a phone running the web app (T-215): a
 * song's background image comes through the WebRTC tunnel while the PC is
 * in reach, and from the church's bucket (where the PC publishes what its
 * synced data shows, by content) once it isn't, kept by the browser for
 * offline use. A video the PC keeps to itself (videos are off by default)
 * shows as unavailable.
 */

// Chromium hides its host addresses behind mDNS names the PC's WebRTC peer
// can't resolve; a real phone away from the church connects by its public
// (STUN) address instead.
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
})

const s3 = new FakeS3()
const service = new SyncService()
const publicApp = new PublicAppServer()

/** A church media file in the bucket: `.../media/<sha256>`. */
const BUCKET_MEDIA = /\/churches\/[^/]+\/media\/[0-9a-f]{64}$/

/** Only the PC serves music: the phone's own server answers 503. */
async function onThePc(page: Page): Promise<boolean> {
  return (await pageApi(page, 'GET', '/api/music/folders')).status !== 503
}

async function setRemoteAccess(request: APIRequestContext, enabled: boolean) {
  const res = await request.put('/api/remote-access', { data: { enabled } })
  expect(res.ok()).toBe(true)
}

/** The church's media index as the PC published it, or null. */
function mediaIndex(): Record<string, { hash: string }> | null {
  const put = [...s3.requests]
    .reverse()
    .find((line) => /^PUT .*\/media\/index\.json$/.test(line))
  const text = put && s3.text(put.slice('PUT '.length))
  return text ? JSON.parse(text).media : null
}

async function saveSongWithBackground(
  request: APIRequestContext,
  title: string,
  background: Record<string, unknown>,
): Promise<number> {
  const res = await request.post('/api/songs', {
    data: {
      title,
      background,
      slides: [{ content: `<p>${title}</p>`, sortOrder: 0 }],
    },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()).data.id
}

/** Presents a song from the phone and opens its page: its live preview. */
async function showSong(page: Page, title: string): Promise<Locator> {
  const songId = await findSong(page, title)
  expect(songId).toBeTruthy()
  await page.goto(`${publicApp.url}/songs/${songId}`)
  await waitForApp(page)
  const presented = await pageApi(
    page,
    'POST',
    '/api/presentation/temporary-song',
    { songId, slideIndex: 0 },
  )
  expect(presented.status, JSON.stringify(presented.json)).toBe(200)
  return page.getByTestId('live-preview').getByTestId('screen-background')
}

/** The song's background as the page's own server has it. */
async function storedBackground(page: Page, title: string) {
  const song = await pageApi(
    page,
    'GET',
    `/api/songs/${await findSong(page, title)}`,
  )
  return (song.json?.data as { background?: unknown } | undefined)?.background
}

/** The image the background layer shows, once it has loaded: its URL. */
async function loadedBackgroundImage(background: Locator): Promise<string> {
  const layer = background.getByTestId('screen-background-image')
  await expect(layer).toHaveCount(1, { timeout: 30_000 })
  const style = (await layer.getAttribute('style')) ?? ''
  const src = style.match(/url\("([^"]+)"\)/)?.[1] ?? ''
  const width = await layer.evaluate(async (_el, url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    return image.naturalWidth
  }, src)
  expect(width).toBeGreaterThan(0)
  return src
}

test.describe
  .serial('Church media on a phone running the web app', () => {
    test.setTimeout(180_000)

    const stamp = Date.now()
    const imageSongTitle = `E2E Media Image ${stamp}`
    const videoSongTitle = `E2E Media Video ${stamp}`
    const songIds: number[] = []
    const mediaIds: string[] = []
    let imageId = ''
    let joinUrl = ''
    let stopRelay = () => {}
    /** One phone: its browser keeps the church and the media it loaded. */
    let phone: BrowserContext
    let page: Page

    test.beforeAll(async ({ request }) => {
      // The public app's build and the PC's first upload of its whole
      // library (26k songs) take a while.
      test.setTimeout(300_000)
      // Only the service's keys, or a URL it presigned, may write.
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, {
        ALLOWED_ORIGINS: publicApp.url,
        SYNC_COMPACT_AFTER: '100000',
      })
      stopRelay = await relayToService(service.url)
      await publicApp.start()

      const image = await uploadMedia(
        request,
        readFileSync(JPEG_FIXTURE),
        'image/jpeg',
        'still.jpg',
      )
      const video = await uploadMedia(
        request,
        readFileSync(WEBM_FIXTURE),
        'video/webm',
        'loop.webm',
      )
      imageId = image.id
      mediaIds.push(image.id, video.id)
      songIds.push(
        await saveSongWithBackground(request, imageSongTitle, {
          type: 'image',
          imageUrl: image.url,
          color: '#000000',
          opacity: 1,
        }),
        await saveSongWithBackground(request, videoSongTitle, {
          type: 'video',
          videoUrl: video.url,
          color: '#000000',
          opacity: 1,
        }),
      )

      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      await setRemoteAccess(request, true)
      const users = (await (await request.get('/api/auth/local-users')).json())
        .data as { id: number; isSuperAdmin: boolean }[]
      const minted = await request.post('/api/sync/cloud/devices', {
        data: {
          userId: users.find((user) => user.isSuperAdmin)?.id,
          name: 'E2E media phone',
        },
      })
      expect(minted.status()).toBe(201)
      joinUrl = (await minted.json()).data.joinUrl

      // The PC publishes its library, then the media it shows: the image,
      // not the video (videos are off by default).
      await expect
        .poll(
          async () => {
            await request.post('/api/sync/now')
            return mediaIndex()?.[imageId] ?? null
          },
          { timeout: 120_000, intervals: [1000, 2000] },
        )
        .not.toBeNull()
      expect(mediaIndex()?.[video.id]).toBeUndefined()
    })

    test.afterAll(async ({ request }) => {
      test.setTimeout(120_000)
      try {
        await phone?.close()
        await request.post('/api/presentation/stop')
        await setRemoteAccess(request, false)
        // Still connected, the next spec to connect would get a 409.
        expect((await request.delete('/api/sync/cloud')).ok()).toBe(true)
        for (const id of songIds) await request.delete(`/api/songs/${id}`)
        for (const id of mediaIds) await request.delete(`${MEDIA_API}/${id}`)
      } finally {
        // Whatever failed, the ports are let go for the next spec.
        await publicApp.stop()
        stopRelay()
        await service.dispose()
        await s3.stop()
      }
    })

    test('with the PC on, the song’s background comes through the tunnel', async ({
      browser,
    }) => {
      phone = await browser.newContext({ ...devices['Pixel 7'] })
      page = await phone.newPage()
      await page.goto(joinUrl)
      await waitForApp(page)
      await expect.poll(() => onThePc(page), { timeout: 60_000 }).toBe(true)

      const src = await loadedBackgroundImage(
        await showSong(page, imageSongTitle),
      )
      // The PC's file, fetched over WebRTC: no bucket involved.
      expect(src).toMatch(/^blob:/)
    })

    test('with the PC out of reach, it comes from the church’s bucket', async ({
      request,
    }) => {
      // The phone starts over on its own server once the tunnel closes.
      await setRemoteAccess(request, false)
      await expect.poll(() => onThePc(page), { timeout: 90_000 }).toBe(false)
      await waitForApp(page)
      // The song came with its background from the church's bucket.
      await expect
        .poll(() => storedBackground(page, imageSongTitle), { timeout: 60_000 })
        .toMatchObject({ type: 'image', imageUrl: `${MEDIA_API}/${imageId}` })

      const src = await loadedBackgroundImage(
        await showSong(page, imageSongTitle),
      )
      const { hash } = mediaIndex()?.[imageId] ?? { hash: '' }
      expect(src.startsWith(`${s3.endpoint}/${SYNC_BUCKET}/churches/`)).toBe(
        true,
      )
      expect(src).toMatch(BUCKET_MEDIA)
      expect(src.endsWith(`/media/${hash}`)).toBe(true)
      expect(s3.requests).toContain(`GET ${new URL(src).pathname}`)
    })

    test('a video the PC keeps to itself shows as unavailable', async () => {
      const background = await showSong(page, videoSongTitle)
      const placeholder = background.getByTestId('media-unavailable')
      await expect(placeholder).toBeVisible({ timeout: 30_000 })
      await expect(placeholder).toHaveAttribute('data-media-kind', 'video')
    })

    test('offline, the image still shows from the browser’s cache', async () => {
      await phone.setOffline(true)
      try {
        await page.reload()
        await waitForApp(page)
        const src = await loadedBackgroundImage(
          await showSong(page, imageSongTitle),
        )
        expect(src).toMatch(BUCKET_MEDIA)
      } finally {
        await phone.setOffline(false)
      }
    })
  })
