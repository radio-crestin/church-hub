import {
  type APIRequestContext,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { relayToService } from './helpers/relay-to-service'
import { SyncService } from './helpers/sync-service'
import { findSong, pageApi, waitForApp } from './helpers/web-app'
import { SIGNALING_RELAY_URL } from '../playwright.config'

/**
 * Phones reach the church PC over WebRTC when it's online (T-174): a phone
 * that joined with a link (T-168) away from the church connects to the PC
 * through the PC's room on churchhub-backend's /signal routes, signs in with
 * its device token as its own user, and runs the full app on the PC's live
 * API and WebSocket events: a song saved on the PC reaches the phone at
 * once. With the PC out of reach, it runs the church's server itself, synced
 * through the cloud (T-175).
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

/** Only the PC serves music: the phone's own server answers 503. */
async function onThePc(page: Page): Promise<boolean> {
  return (await pageApi(page, 'GET', '/api/music/folders')).status !== 503
}

async function setRemoteAccess(request: APIRequestContext, enabled: boolean) {
  const res = await request.put('/api/remote-access', { data: { enabled } })
  expect(res.ok()).toBe(true)
}

/** Runs sync cycles until the PC has published everything it queued. */
async function publishAll(request: APIRequestContext) {
  await expect
    .poll(
      async () => {
        await request.post('/api/sync/now')
        const status = (await (await request.get('/api/sync/status')).json())
          .data
        return status.pendingCount
      },
      { timeout: 90_000, intervals: [500, 1000, 2000] },
    )
    .toBe(0)
}

/** Saves a song on the PC (a new one without `id`); returns its id. */
async function saveSong(
  request: APIRequestContext,
  song: { id?: number; title: string; lyrics: string },
): Promise<number> {
  const res = await request.post('/api/songs', {
    data: {
      id: song.id,
      title: song.title,
      slides: [{ content: `<p>${song.lyrics}</p>`, sortOrder: 0 }],
    },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()).data.id
}

test.describe
  .serial('Phones reach the PC over WebRTC', () => {
    test.setTimeout(180_000)

    const userName = `E2E WebRTC ${Date.now()}`
    let userId = 0
    let joinUrl = ''
    let stopRelay = () => {}

    test.beforeAll(async ({ request }) => {
      // The public app's build (the whole app and its server) takes a while.
      test.setTimeout(300_000)
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, {
        ALLOWED_ORIGINS: publicApp.url,
        SYNC_COMPACT_AFTER: '100000',
      })
      stopRelay = await relayToService(service.url)
      await publicApp.start()

      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      await setRemoteAccess(request, true)
      const user = await request.post('/api/users', {
        data: { name: userName, permissions: ['songs.view'] },
      })
      userId = (await user.json()).data.user.id
      const minted = await request.post('/api/sync/cloud/devices', {
        data: { userId, name: 'E2E WebRTC phone' },
      })
      expect(minted.status()).toBe(201)
      joinUrl = (await minted.json()).data.joinUrl
      await publishAll(request)
    })

    test.afterAll(async ({ request }) => {
      await setRemoteAccess(request, false)
      await request.delete('/api/sync/cloud')
      await request.delete(`/api/users/${userId}`)
      await publicApp.stop()
      stopRelay()
      await service.dispose()
      await s3.stop()
    })

    test('the join link names the PC’s room and its relay', () => {
      const params = new URLSearchParams(joinUrl.split('#')[1])
      expect(params.get('p')).toMatch(/^[\w-]{16,}$/)
      expect(params.get('r')).toBe(SIGNALING_RELAY_URL)
    })

    test('a joined phone gets the PC’s live API as its own user, and its songs at once', async ({
      browser,
      request,
    }) => {
      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      await page.goto(joinUrl)
      await waitForApp(page)
      expect(await onThePc(page)).toBe(true)

      // Signed in on the PC as the device's user, from elsewhere.
      const me = await pageApi(page, 'GET', '/api/auth/me')
      expect(me.json?.data).toMatchObject({ name: userName })
      expect((await pageApi(page, 'GET', '/api/system-token')).status).toBe(403)

      // The PC's WebSocket reaches the phone: a song saved on the PC is
      // announced at once, long before the cloud's next look.
      const announced = page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const socket = new WebSocket('ws://church-pc.invalid/ws')
            socket.onmessage = (event) => {
              const message = JSON.parse(String(event.data))
              if (message.type === 'song_updated') {
                resolve(message.payload.songId)
              }
            }
          }),
      )
      const title = `E2E Live ${Date.now()}`
      const id = await saveSong(request, { title, lyrics: 'Live from the PC' })
      expect(await announced).toBe(id)
      // …and found by the PC's own search.
      expect(await findSong(page, title)).toBeTruthy()
      await phone.close()
    })

    test('with the PC out of reach the phone runs the church’s server itself', async ({
      browser,
      request,
    }) => {
      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      await page.goto(joinUrl)
      await waitForApp(page)
      expect(await onThePc(page)).toBe(true)

      // Remote access off closes the PC's room and its tunnels: the app
      // starts over on its own server, the church's library synced to it.
      await setRemoteAccess(request, false)
      await expect.poll(() => onThePc(page), { timeout: 150_000 }).toBe(false)
      await waitForApp(page)
      const songs = await pageApi(page, 'GET', '/api/songs?limit=1')
      expect((songs.json?.data as { songs: unknown[] }).songs.length).toBe(1)

      // The PC back: the next start reaches it again.
      await setRemoteAccess(request, true)
      await page.reload()
      await waitForApp(page)
      expect(await onThePc(page)).toBe(true)
      await phone.close()
    })

    test('the PC says when a new link won’t reach it live', async ({
      page,
      request,
    }) => {
      await page.goto('/settings/phones')
      const hint = page.getByTestId('cloud-device-remote-off')
      await setRemoteAccess(request, false)
      await page.reload()
      await expect(hint).toBeVisible()
      await page.getByTestId('remote-access-switch').click()
      await expect(hint).toBeHidden()
    })

    test('the PC refuses a device token the service doesn’t know', async ({
      request,
    }) => {
      const res = await request.post('/api/auth/device-login', {
        data: { token: 'not-a-device-token' },
      })
      expect(res.status()).toBe(401)
    })
  })
