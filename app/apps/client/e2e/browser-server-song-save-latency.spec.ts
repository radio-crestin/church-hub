import { type APIRequestContext, devices, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import { FakeS3 } from './helpers/fake-s3'
import { PublicAppServer } from './helpers/public-app'
import { SyncService } from './helpers/sync-service'
import { pageApi, waitForApp } from './helpers/web-app'

/**
 * A joined phone's in-browser server (T-175) answers right after a song is
 * saved and while its sync sends it (T-218): the save used to scan the whole
 * search index (~2 s) and the sync round serialize and merge the whole
 * library (~9 s), each blocking the worker.
 */

const s3 = new FakeS3()
const service = new SyncService()
const publicApp = new PublicAppServer()
const pc = new ExtraServer()

/** The page's server, as the web app calls it. */
const WEB_APP_API = 'http://church-pc.invalid'
/** Long enough for the phone's sync to pick the save up and send it. */
const WATCH_MS = 12_000

async function syncPcUntilIdle(api: APIRequestContext) {
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
}

test.describe
  .serial('A joined phone’s server after a song save', () => {
    test.setTimeout(300_000)

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
        await pc.dispose()
      } finally {
        await publicApp.stop()
        await service.dispose()
        await s3.stop()
      }
    })

    test('every call answers in under a second while the save syncs', async ({
      browser,
    }) => {
      // The PC publishes its library to the cloud, mints a phone's link and
      // turns off.
      await pc.start({
        CHURCH_HUB_SYNC_URL: service.url,
        CHURCH_HUB_PUBLIC_APP_URL: publicApp.url,
      })
      const api = await pc.adminRequest()
      const connected = await api.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      const users = (await (await api.get('/api/auth/local-users')).json())
        .data as { id: number; isSuperAdmin: boolean }[]
      const device = await api.post('/api/sync/cloud/devices', {
        data: {
          userId: users.find((user) => user.isSuperAdmin)?.id,
          name: 'E2E phone',
        },
      })
      const { joinUrl } = (await device.json()).data
      await syncPcUntilIdle(api)
      await api.dispose()
      await pc.stop()

      const phone = await browser.newContext({ ...devices['Pixel 7'] })
      const page = await phone.newPage()
      await page.goto(joinUrl)
      await waitForApp(page)

      const lyric = `Saved on the phone ${Date.now()}`
      const song = await pageApi(page, 'POST', '/api/songs', {
        title: `E2E Quick Save ${Date.now()}`,
        slides: [{ content: `<p>${lyric}</p>`, sortOrder: 0 }],
      })
      expect(song.status, JSON.stringify(song.json)).toBe(201)
      const songId = (song.json?.data as { id: number }).id
      const presented = await pageApi(
        page,
        'POST',
        '/api/presentation/temporary-song',
        { songId, slideIndex: 0 },
      )
      expect(presented.status).toBe(200)

      // Calls made one after another while the save syncs, each timed in
      // the page (the call's own time, not Playwright's round trip).
      const times = await page.evaluate(
        async ({ api, watchMs }) => {
          const until = performance.now() + watchMs
          const times: number[] = []
          while (performance.now() < until) {
            const started = performance.now()
            await (await fetch(`${api}/api/screens`)).json()
            times.push(Math.round(performance.now() - started))
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          return times
        },
        { api: WEB_APP_API, watchMs: WATCH_MS },
      )
      expect(
        Math.max(...times),
        `GET /api/screens while the save syncs (ms): ${times}`,
      ).toBeLessThan(1000)

      // Its words are found at once (the index row is the song's rowid).
      const found = await pageApi(
        page,
        'GET',
        `/api/songs/search?q=${encodeURIComponent(lyric)}`,
      )
      expect(
        (found.json?.data as { id: number }[]).map((hit) => hit.id),
      ).toContain(songId)

      // The save did sync: nothing is left to send.
      await expect
        .poll(
          async () =>
            (
              (await pageApi(page, 'GET', '/api/sync/status')).json?.data as {
                pendingCount: number
              }
            ).pendingCount,
          { timeout: 60_000 },
        )
        .toBe(0)
      await phone.close()
    })
  })
