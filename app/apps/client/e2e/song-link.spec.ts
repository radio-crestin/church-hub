import { type APIRequestContext, devices, expect, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'
import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { SyncService } from './helpers/sync-service'
import { waitForApp } from './helpers/web-app'

/**
 * A song shared by a link (T-177): "Share link" in the song's menu
 * publishes it through the sync service and hands out a page on the public
 * web app, with its words and chords for anyone; a device joined to the
 * church opens the song in the app instead. Stopping the link ends both.
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
  .serial('Share a song by link', () => {
    test.setTimeout(180_000)

    const title = `E2E Linked ${Date.now()}`
    let songId = 0
    let link = ''
    let joinUrl = ''
    let phoneUserId = 0

    test.beforeAll(async ({ request }) => {
      // The public app's build takes a while.
      test.setTimeout(300_000)
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, {
        ALLOWED_ORIGINS: publicApp.url,
        SYNC_COMPACT_AFTER: '100000',
      })
      await publicApp.start()

      const created = await request.post('/api/songs', {
        data: {
          title,
          author: 'E2E Author',
          keyLine: 'G',
          slides: [
            {
              content: '<p>Glory to God</p><p>in the highest</p>',
              sortOrder: 0,
              label: 'V1',
              // On "Glory" and on "highest" (a line break takes a place).
              chords: [
                { wordIndex: 0, chord: 'G' },
                { wordIndex: 6, chord: 'D7' },
              ],
            },
            { content: '<p>Peace on earth</p>', sortOrder: 1, label: 'C' },
          ],
        },
      })
      expect(created.status()).toBe(201)
      songId = (await created.json()).data.id
    })

    test.afterAll(async ({ request }) => {
      try {
        if (songId) await request.delete(`/api/songs/${songId}`)
        if (phoneUserId) await request.delete(`/api/users/${phoneUserId}`)
        await request.delete('/api/sync/cloud')
      } finally {
        await publicApp.stop()
        await service.dispose()
        await s3.stop()
      }
    })

    test('with cloud sync off, a song has no link yet', async ({ request }) => {
      const refused = await request.post(`/api/song-links/${songId}`)
      expect(refused.status()).toBe(409)
      expect((await refused.json()).code).toBe('cloud_sync_off')
    })

    test('"Share link" gives a page anyone opens: words, chords over them, and the key', async ({
      page,
      request,
      browser,
    }) => {
      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)

      await setAppLanguage(page, 'en')
      await page.goto(`/songs/${songId}`)
      await selectAction(page, 'song-actions-menu', 'song-share-link')
      const dialog = page.getByTestId('song-link-dialog')
      const url = dialog.getByTestId('song-link-url')
      await expect(url).toContainText(`${publicApp.url}/song/`)
      link = (await url.textContent()) ?? ''
      expect(link).toMatch(
        new RegExp(`^${publicApp.url}/song/[0-9a-f]{32}\\?s=`),
      )
      await dialog.getByRole('button', { name: 'Close' }).click()

      // The same song keeps its link: sharing it again updates the page.
      const again = await request.post(`/api/song-links/${songId}`)
      expect((await again.json()).data.url).toBe(link)

      const visitor = await browser.newContext({ ...devices['Pixel 7'] })
      const visit = await visitor.newPage()
      await visit.goto(link)
      const song = visit.getByTestId('shared-song')
      await expect(song.getByRole('heading', { level: 1 })).toHaveText(title)
      await expect(song).toContainText('E2E Author · Key G')
      const slides = song.getByTestId('shared-song-slide')
      await expect(slides).toHaveCount(2)
      await expect(slides.first()).toContainText('V1')
      await expect(slides.first()).toContainText('Glory')
      await expect(slides.nth(1)).toContainText('Peace on earth')
      const chords = song.getByTestId('shared-song-chord')
      await expect(chords.filter({ hasText: /^G$/ })).toHaveCount(1)
      await expect(chords.filter({ hasText: /^D7$/ })).toHaveCount(1)
      // Chords hide for those who only sing.
      await visit.getByTestId('shared-song-chords-toggle').click()
      await expect(chords).toHaveCount(0)
      // A visitor is no member: nothing of the app starts, nobody joins.
      expect(
        await visit.evaluate(() =>
          localStorage.getItem('church-hub-church-binding'),
        ),
      ).toBeNull()
      await visitor.close()
    })

    test('a device of the church opens the link in the app, on the song', async ({
      browser,
      request,
    }) => {
      const phoneUser = await request.post('/api/users', {
        data: {
          name: `E2E Link phone ${Date.now()}`,
          permissions: ['songs.view'],
        },
      })
      phoneUserId = (await phoneUser.json()).data.user.id
      const device = await request.post('/api/sync/cloud/devices', {
        data: { userId: phoneUserId, name: 'E2E link phone' },
      })
      expect(device.status()).toBe(201)
      joinUrl = (await device.json()).data.joinUrl
      await publishAll(request)

      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      await page.goto(joinUrl)
      await waitForApp(page)
      await page.goto(link)
      await expect(page).toHaveURL(
        new RegExp(`^${publicApp.url}/songs/\\d+$`),
        { timeout: 60_000 },
      )
      await expect(page.getByText(title).first()).toBeVisible({
        timeout: 30_000,
      })
      await phone.close()
    })

    test('stopping the link: its page says the song is no longer shared', async ({
      page,
      browser,
    }) => {
      await setAppLanguage(page, 'en')
      await page.goto(`/songs/${songId}`)
      await selectAction(page, 'song-actions-menu', 'song-share-link')
      const dialog = page.getByTestId('song-link-dialog')
      await expect(dialog.getByTestId('song-link-url')).toHaveText(link)
      await dialog.getByTestId('song-link-stop').click()
      await expect(
        page.getByText('The link no longer opens this song.'),
      ).toBeVisible()

      const visitor = await browser.newContext()
      const visit = await visitor.newPage()
      await visit.goto(link)
      await expect(visit.getByTestId('session-notice')).toHaveAttribute(
        'data-notice',
        'song.notFound',
      )
      await visitor.close()
    })
  })
