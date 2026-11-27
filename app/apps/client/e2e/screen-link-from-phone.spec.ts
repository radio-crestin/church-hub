import {
  type BrowserContext,
  devices,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { SyncService } from './helpers/sync-service'
import { pageApi, waitForApp } from './helpers/web-app'

/**
 * Another device shows a phone's screen over WebRTC (T-214): with the
 * church PC off, a joined phone runs the church's server itself (T-175) and
 * makes a screen link; a TV opens it, connects to the phone through the
 * phone's room on the signaling relay, signs in with the link alone and
 * shows what the phone puts live. Revoking the link cuts the TV off.
 */

// Chromium hides its host addresses behind mDNS names the other peer can't
// resolve here; real devices connect by their public (STUN) address.
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
})

const s3 = new FakeS3()
const service = new SyncService()
const publicApp = new PublicAppServer()
const pc = new ExtraServer()

test.describe
  .serial('A screen link from a phone, with the PC off', () => {
    test.setTimeout(300_000)

    const lyrics = `Shown on the TV ${Date.now()}`
    let joinUrl = ''
    let phone: BrowserContext
    let phonePage: Page
    let tv: BrowserContext
    let tvPage: Page
    let screenLink = ''

    test.beforeAll(async () => {
      test.setTimeout(300_000)
      await s3.start()
      await service.start(s3.endpoint, {
        ALLOWED_ORIGINS: publicApp.url,
        SYNC_COMPACT_AFTER: '100000',
      })
      await publicApp.start()
    })

    test.afterAll(async () => {
      try {
        await tv?.close()
        await phone?.close()
        await pc.dispose()
      } finally {
        await publicApp.stop()
        await service.dispose()
        await s3.stop()
      }
    })

    test('the PC mints a phone’s link, publishes the church, then turns off', async () => {
      // The sync service is the signaling relay too (its /signal routes).
      await pc.start({
        CHURCH_HUB_SYNC_URL: service.url,
        CHURCH_HUB_PUBLIC_APP_URL: publicApp.url,
        CHURCH_HUB_SIGNALING_URL: service.url,
      })
      const api = await pc.adminRequest()
      expect(
        (
          await api.post('/api/sync/cloud', {
            data: { serviceUrl: service.url },
          })
        ).status(),
      ).toBe(200)
      const users = (await (await api.get('/api/auth/local-users')).json())
        .data as { id: number; isSuperAdmin: boolean }[]
      const admin = users.find((user) => user.isSuperAdmin)
      const device = await api.post('/api/sync/cloud/devices', {
        data: { userId: admin?.id, name: 'E2E screen phone' },
      })
      expect(device.status()).toBe(201)
      joinUrl = (await device.json()).data.joinUrl
      await expect
        .poll(
          async () => {
            await api.post('/api/sync/now')
            return (await (await api.get('/api/sync/status')).json()).data
              .pendingCount
          },
          { timeout: 90_000, intervals: [500, 1000, 2000] },
        )
        .toBe(0)
      await api.dispose()
      await pc.stop()
    })

    test('the phone makes a screen link and a TV opens it', async ({
      browser,
    }) => {
      phone = await browser.newContext({ ...devices['Pixel 7'] })
      phonePage = await phone.newPage()
      await phonePage.goto(joinUrl)
      await waitForApp(phonePage)
      await pageApi(phonePage, 'POST', '/api/settings/app_settings', {
        key: 'language',
        value: 'en',
      })

      const screens = await pageApi(phonePage, 'GET', '/api/screens')
      const [screen] = screens.json?.data as { id: number }[]
      await phonePage.goto(
        `${publicApp.url}/settings/screens?screen=${screen.id}`,
      )
      await waitForApp(phonePage)
      await phonePage
        .getByRole('button', { name: 'More screen actions' })
        .click()
      await phonePage.getByTestId('screen-show-elsewhere').click()
      const url = phonePage.getByTestId('screen-link-url')
      // The phone's server may still be busy finishing its first start.
      await expect(url).toHaveValue(
        new RegExp(`^${publicApp.url}/screen/${screen.id}#`),
        { timeout: 30_000 },
      )
      screenLink = await url.inputValue()
      // A phone has no address on the network: the internet way only.
      await expect(
        phonePage.getByRole('button', { name: 'Advanced' }),
      ).toHaveCount(0)
      // The link carries a token of its own, never the phone's session.
      const fragment = new URLSearchParams(screenLink.split('#')[1])
      expect(fragment.get('g')).toMatch(/^scr_/)

      tv = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      tvPage = await tv.newPage()
      await tvPage.goto(screenLink)
      await expect(tvPage.locator('#loading-screen')).toBeHidden({
        timeout: 60_000,
      })
      // Signed in with the link: what a screen reads, nothing more.
      expect(
        (await pageApi(tvPage, 'GET', '/api/screen-links/session')).status,
      ).toBe(200)
      expect((await pageApi(tvPage, 'GET', '/api/users')).status).toBe(403)
      expect(
        (await pageApi(tvPage, 'POST', '/api/presentation/clear')).status,
      ).toBe(403)
    })

    test('the phone goes live with a song and the TV shows it', async () => {
      const song = await pageApi(phonePage, 'POST', '/api/songs', {
        title: `E2E Screen Link Song ${Date.now()}`,
        slides: [{ content: `<p>${lyrics}</p>`, sortOrder: 0 }],
      })
      const songId = (song.json?.data as { id: number }).id
      const live = await pageApi(
        phonePage,
        'POST',
        '/api/presentation/temporary-song',
        {
          songId,
          slideIndex: 0,
        },
      )
      expect(live.status).toBe(200)
      await expect(
        tvPage.getByText(lyrics, { exact: true }).last(),
      ).toBeVisible({
        timeout: 20_000,
      })
    })

    test('revoking the link cuts the TV off', async () => {
      await phonePage.getByRole('button', { name: 'Revoke link' }).click()
      // Revoked (the phone's server may still be busy with the new song)…
      await expect(phonePage.getByTestId('screen-link-modal')).toHaveCount(0, {
        timeout: 30_000,
      })
      // …the TV is cut off at once: the phone closes its channel, not only
      // its connection (which would end only when its ICE times out).
      await expect(tvPage.getByText(lyrics, { exact: true })).toHaveCount(0, {
        timeout: 5_000,
      })
      // It comes back to the phone once more, to hear the link was revoked.
      await expect(
        tvPage.getByText('This screen link no longer works.'),
      ).toBeVisible({ timeout: 60_000 })
    })
  })
