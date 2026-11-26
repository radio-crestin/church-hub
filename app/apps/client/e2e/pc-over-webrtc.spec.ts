import { type APIRequestContext, devices, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { relayToService } from './helpers/relay-to-service'
import { SyncService } from './helpers/sync-service'
import { SIGNALING_RELAY_URL } from '../playwright.config'

/**
 * Phones reach the church PC over WebRTC when it's online (T-174): a phone
 * that joined with a link (T-168) away from the church connects to the PC
 * through the PC's room on churchhub-backend's /signal routes, signs in with
 * its device token as its own user, and gets the PC's live API and
 * WebSocket events: a song saved on the PC shows on the phone at once. With
 * the PC out of reach, it reads the cloud.
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
/** The phone's address for the PC's API (features/public-app pcApiOrigin). */
const PC = 'http://church-pc.invalid'

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
    let deviceId = ''
    let stopRelay = () => {}

    test.beforeAll(async ({ request }) => {
      // The public app's build and the PC's first upload of its whole
      // library (26k songs) take well over a hook's default 30 s.
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
      const device = (await minted.json()).data
      joinUrl = device.joinUrl
      deviceId = device.deviceId
      await publishAll(request)
    })

    test.afterAll(async ({ request }) => {
      test.setTimeout(120_000)
      try {
        await setRemoteAccess(request, false)
        // Still connected, the next spec to connect would get a 409.
        expect((await request.delete('/api/sync/cloud')).ok()).toBe(true)
        if (userId) await request.delete(`/api/users/${userId}`)
      } finally {
        // Whatever failed, the ports are let go for the next spec.
        await publicApp.stop()
        stopRelay()
        await service.dispose()
        await s3.stop()
      }
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
      const link = page.getByTestId('pc-link')
      await expect(link).toHaveAttribute('data-link', 'live', {
        timeout: 60_000,
      })
      // Its WebSocket to the PC is open: edits from now on reach it.
      await expect(link).toHaveAttribute('data-listening', 'true')

      // Signed in on the PC as the device's user, from elsewhere.
      const me = await page.evaluate(async (pc) => {
        const res = await fetch(`${pc}/api/auth/me`)
        return ((await res.json()) as { data: { name: string } }).data.name
      }, PC)
      expect(me).toBe(userName)
      const systemToken = await page.evaluate(
        async (pc) => (await fetch(`${pc}/api/system-token`)).status,
        PC,
      )
      expect(systemToken).toBe(403)

      // A song saved on the PC is there, found by the PC's own search…
      const title = `E2E Live ${Date.now()}`
      const id = await saveSong(request, { title, lyrics: 'Live from the PC' })
      // Typed key by key: the search box stays while each search loads.
      await page.getByRole('searchbox').pressSequentially(title)
      const song = page.getByTestId('church-song').filter({ hasText: title })
      await song.click()
      const slide = page.getByTestId('song-slide')
      await expect(slide).toHaveText('Live from the PC')

      // …and an edit on the PC shows at once: its WebSocket says so, long
      // before the cloud's minute-long refresh.
      await saveSong(request, { id, title, lyrics: 'Edited on the PC' })
      await expect(slide).toHaveText('Edited on the PC', { timeout: 10_000 })
      await phone.close()
    })

    test('with the PC out of reach the phone reads the cloud, and comes back live', async ({
      browser,
      request,
    }) => {
      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      // Time runs as usual; the test skips ahead to the phone's next look.
      await page.clock.install()
      await page.goto(joinUrl)
      const link = page.getByTestId('pc-link')
      await expect(link).toHaveAttribute('data-link', 'live', {
        timeout: 60_000,
      })

      // Remote access off closes the PC's room and its tunnels.
      await setRemoteAccess(request, false)
      await expect(link).toHaveAttribute('data-link', 'cloud', {
        timeout: 30_000,
      })
      await expect(page.getByTestId('church-song').first()).toBeVisible()

      // The phone looks for the PC again and finds it.
      await setRemoteAccess(request, true)
      await page.clock.fastForward(31_000)
      await expect(link).toHaveAttribute('data-link', 'live', {
        timeout: 60_000,
      })
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

    test('the PC refuses a device token the service doesn’t know, and slows down guessing', async ({
      request,
    }) => {
      const statuses: number[] = []
      while (statuses.at(-1) !== 429 && statuses.length < 6) {
        const res = await request.post('/api/auth/device-login', {
          data: { token: 'not-a-device-token' },
        })
        statuses.push(res.status())
      }
      // Five refusals a minute, then 429 (a repeat run may start counted).
      expect(statuses.at(-1)).toBe(429)
      expect(statuses.slice(0, -1).every((status) => status === 401)).toBe(true)
    })

    test('revoking the device ends the phone’s session on the PC', async ({
      browser,
      request,
    }) => {
      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      await page.goto(joinUrl)
      await expect(page.getByTestId('pc-link')).toHaveAttribute(
        'data-link',
        'live',
        { timeout: 60_000 },
      )
      // A route that needs the session (songs.view), unlike public /me.
      const songs = () =>
        page.evaluate(
          async (pc) => (await fetch(`${pc}/api/songs?limit=1`)).status,
          PC,
        )
      expect(await songs()).toBe(200)

      const revoked = await request.delete(
        `/api/sync/cloud/devices/${deviceId}`,
      )
      expect(revoked.ok()).toBe(true)
      expect(await songs()).toBe(401)
      await phone.close()
    })
  })
