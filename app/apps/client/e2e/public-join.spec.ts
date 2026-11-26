import { type APIRequestContext, devices, expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { SyncService } from './helpers/sync-service'
import { findSong, waitForApp } from './helpers/web-app'

/**
 * Join a church by QR code or link (T-168): the PC mints a device token in
 * Settings > Phones and shows the link; a phone opens it on the public web
 * app, which binds it to the church and runs the full app on the church's
 * library, synced from the bucket into its own server (T-175), offline
 * too. Revoking the device ends that.
 */

const s3 = new FakeS3()
const service = new SyncService()
const publicApp = new PublicAppServer()

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

test.describe
  .serial('Join a church with a link', () => {
    test.setTimeout(180_000)

    const title = `E2E Join ${Date.now()}`
    let joinUrl = ''

    test.beforeAll(async () => {
      // The public app's build (the whole app and its server) takes a while.
      test.setTimeout(300_000)
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, {
        // The public app calls the service from its own origin.
        ALLOWED_ORIGINS: publicApp.url,
        SYNC_COMPACT_AFTER: '100000',
      })
      await publicApp.start()
    })

    test.afterAll(async ({ request }) => {
      try {
        await request.delete('/api/sync/cloud')
      } finally {
        // Whatever failed, the ports are let go for the next spec.
        await publicApp.stop()
        await service.dispose()
        await s3.stop()
      }
    })

    test('the PC connects to the cloud and shows a join link for a new device', async ({
      page,
      request,
    }) => {
      await request.post('/api/songs', {
        data: {
          title,
          author: 'E2E Author',
          slides: [
            {
              content: '<p>Glory to God</p><p>in the highest</p>',
              sortOrder: 0,
              label: 'V1',
            },
          ],
        },
      })

      // The shipped fixtures save Romanian; the assertions read English.
      await setAppLanguage(page, 'en')
      await page.goto('/settings/phones')
      await page.getByTestId('cloud-connect').click()
      await page.getByLabel('Device name').fill('E2E phone')
      await page.getByTestId('cloud-device-create').click()

      const qr = page.getByTestId('join-qr')
      await expect(qr).toBeVisible()
      joinUrl = (await qr.getAttribute('data-url')) ?? ''
      // Everything in the fragment: no server logs the token.
      expect(joinUrl).toMatch(
        new RegExp(
          `^${publicApp.url}/join#c=[A-Za-z0-9_-]{16}-[A-Za-z0-9_-]{43}&t=[^&]+$`,
        ),
      )
      await expect(page.getByTestId('cloud-device')).toContainText('E2E phone')
      await publishAll(request)
    })

    test('a phone opens the link: it joins, forgets the link and has the songs, offline too', async ({
      browser,
    }) => {
      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      await page.goto(joinUrl)
      await waitForApp(page)
      await expect(page).toHaveURL(new RegExp(`^${publicApp.url}/(?!join)`))
      expect(await findSong(page, title)).toBeTruthy()

      // Bound: it opens on the church's songs without the link.
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.goto(publicApp.url)
      await waitForApp(page)
      expect(await findSong(page, title)).toBeTruthy()

      // The service worker keeps the app, and the browser its database.
      await phone.setOffline(true)
      await page.reload()
      await waitForApp(page)
      expect(await findSong(page, title)).toBeTruthy()
      await phone.close()
    })

    test('revoking the device on the PC removes it from the church', async ({
      page,
      browser,
    }) => {
      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const phonePage = await phone.newPage()
      await phonePage.goto(joinUrl)
      await waitForApp(phonePage)

      await setAppLanguage(page, 'en')
      await page.goto('/settings/phones')
      const device = page
        .getByTestId('cloud-device')
        .filter({ hasText: 'E2E phone' })
        .first()
      await device.getByRole('button', { name: 'Revoke' }).click()
      await page
        .getByTestId('cloud-device-revoke-confirm')
        .getByRole('button', { name: 'Revoke' })
        .click()
      await expect(device).toContainText('Revoked')

      await phonePage.reload()
      await expect(phonePage.getByTestId('session-notice')).toHaveAttribute(
        'data-notice',
        'removed',
      )

      // The same link no longer lets anyone in.
      await phonePage.goto(joinUrl)
      await expect(phonePage.getByTestId('session-notice')).toHaveAttribute(
        'data-notice',
        'joinFailed.refused',
      )
      await expect(phonePage).toHaveURL(`${publicApp.url}/`)
      await phone.close()
    })

    test('a link that is not a join link says so', async ({ browser }) => {
      const phone = await browser.newContext()
      const page = await phone.newPage()
      await page.goto(`${publicApp.url}/join#c=nope&t=x`)
      await expect(page.getByTestId('session-notice')).toHaveAttribute(
        'data-notice',
        'joinFailed.invalid',
      )
      await phone.close()
    })
  })
