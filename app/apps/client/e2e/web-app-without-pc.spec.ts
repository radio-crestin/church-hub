import {
  type APIRequestContext,
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
import { findSchedule, findSong, pageApi, waitForApp } from './helpers/web-app'

/**
 * The web app runs the church server itself when no church PC answers
 * (T-175): a joined phone runs the server's own API on sqlite-wasm in a Web
 * Worker, reads the church from its bucket and writes through the sync
 * service, so it keeps full control with the PC off; the PC pulls its edits
 * when it comes back. With no church, it opens as a guest on the library a
 * new PC starts with.
 */

const s3 = new FakeS3()
const service = new SyncService()
const publicApp = new PublicAppServer()
/** The church PC: a server of its own, so the spec can turn it off. */
const pc = new ExtraServer()
const pcEnv = () => ({
  CHURCH_HUB_SYNC_URL: service.url,
  CHURCH_HUB_PUBLIC_APP_URL: publicApp.url,
})

/** Runs the PC's sync cycles until `done` holds. */
async function syncPcUntil(
  api: APIRequestContext,
  done: () => Promise<boolean>,
) {
  await expect
    .poll(
      async () => {
        await api.post('/api/sync/now')
        return done()
      },
      { timeout: 90_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true)
}

async function songTitle(api: APIRequestContext, id: number) {
  return (await (await api.get(`/api/songs/${id}`)).json()).data?.title
}

async function scheduleTitle(api: APIRequestContext, id: number) {
  return (await (await api.get(`/api/schedules/${id}`)).json()).data?.title
}

test.describe
  .serial('The web app without the church PC', () => {
    test.setTimeout(300_000)

    const stamp = Date.now()
    const songTitleOnPc = `E2E Offline Song ${stamp}`
    const songTitleFromPhone = `E2E Edited On The Phone ${stamp}`
    const scheduleTitleOnPc = `E2E Sunday ${stamp}`
    const scheduleTitleFromPhone = `E2E Sunday, from the phone ${stamp}`
    let songId = 0
    let scheduleId = 0
    let joinUrl = ''
    /** One phone: its browser keeps the church (OPFS, local storage). */
    let phone: BrowserContext
    let phonePage: Page

    test.beforeAll(async () => {
      // The public app's build (the whole app and its server) takes a while.
      test.setTimeout(300_000)
      await s3.start()
      await service.start(s3.endpoint, {
        // The web app calls the service from its own origin.
        ALLOWED_ORIGINS: publicApp.url,
        SYNC_COMPACT_AFTER: '100000',
      })
      await publicApp.start()
    })

    test.afterAll(async () => {
      await phone?.close()
      await pc.dispose()
      await publicApp.stop()
      await service.dispose()
      await s3.stop()
    })

    test('the PC joins the cloud, mints a link for a phone, then turns off', async () => {
      await pc.start(pcEnv())
      const api = await pc.adminRequest()

      const song = await api.post('/api/songs', {
        data: {
          title: songTitleOnPc,
          slides: [{ content: '<p>Amazing grace</p>', sortOrder: 0 }],
        },
      })
      songId = (await song.json()).data.id
      const schedule = await api.post('/api/schedules', {
        data: { title: scheduleTitleOnPc },
      })
      scheduleId = (await schedule.json()).data.id

      const connected = await api.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      const users = (await (await api.get('/api/auth/local-users')).json())
        .data as { id: number; isSuperAdmin: boolean }[]
      const admin = users.find((user) => user.isSuperAdmin)
      const device = await api.post('/api/sync/cloud/devices', {
        data: { userId: admin?.id, name: 'E2E phone' },
      })
      expect(device.status()).toBe(201)
      joinUrl = (await device.json()).data.joinUrl
      expect(joinUrl).toContain(`${publicApp.url}/join#`)

      await syncPcUntil(
        api,
        async () =>
          (await (await api.get('/api/sync/status')).json()).data
            .pendingCount === 0,
      )
      await api.dispose()
      await pc.stop()
    })

    test('the phone opens the link and runs the whole app on its own server', async ({
      browser,
    }) => {
      phone = await browser.newContext({ ...devices['Pixel 7'] })
      phonePage = await phone.newPage()
      await phonePage.goto(joinUrl)
      await waitForApp(phonePage)
      await expect(phonePage).toHaveURL(new RegExp(`^${publicApp.url}/`))

      // The church's library, from its bucket: its song and its program.
      expect(await findSong(phonePage, songTitleOnPc)).toBeTruthy()
      expect(await findSchedule(phonePage, scheduleTitleOnPc)).toBeTruthy()
      // Signed in as the device's user, with their permissions.
      const me = await pageApi(phonePage, 'GET', '/api/auth/me')
      expect(me.json?.data).toMatchObject({ name: 'Super Admin' })
      // What only the PC has says so.
      expect(
        (await pageApi(phonePage, 'GET', '/api/music/folders')).status,
      ).toBe(503)
    })

    test('the phone edits a song and a program; the edits reach the cloud', async () => {
      const page = phonePage
      // Bound now: it opens on the church without the link, from its OPFS.
      await page.goto(publicApp.url)
      await waitForApp(page)

      const id = await findSong(page, songTitleOnPc)
      const song = await pageApi(page, 'GET', `/api/songs/${id}`)
      const saved = await pageApi(page, 'POST', '/api/songs', {
        ...(song.json?.data as object),
        id,
        title: songTitleFromPhone,
        slides: [{ content: '<p>How sweet the sound</p>', sortOrder: 0 }],
      })
      expect(saved.status, JSON.stringify(saved.json)).toBe(200)
      const renamed = await pageApi(page, 'POST', '/api/schedules', {
        id: await findSchedule(page, scheduleTitleOnPc),
        title: scheduleTitleFromPhone,
      })
      expect(renamed.status, JSON.stringify(renamed.json)).toBe(200)

      // The same full-text search as on the PC, on the phone.
      const found = await pageApi(
        page,
        'GET',
        `/api/songs/search?q=${encodeURIComponent('sweet the sound')}`,
      )
      expect(
        (found.json?.data as { title: string }[]).map((s) => s.title),
      ).toContain(songTitleFromPhone)

      // Its sync sends them through the service, as the PC's would.
      await expect
        .poll(
          async () => {
            await pageApi(page, 'POST', '/api/sync/now')
            const status = (await pageApi(page, 'GET', '/api/sync/status')).json
              ?.data as { pendingCount: number; lastError: string | null }
            return status.pendingCount === 0 && status.lastError === null
          },
          { timeout: 90_000, intervals: [1000, 2000] },
        )
        .toBe(true)
    })

    test('the PC starts again and pulls the phone’s edits', async () => {
      await pc.start(pcEnv())
      const api = await pc.adminRequest()
      await syncPcUntil(
        api,
        async () =>
          (await songTitle(api, songId)) === songTitleFromPhone &&
          (await scheduleTitle(api, scheduleId)) === scheduleTitleFromPhone,
      )
      await api.dispose()
    })

    test('the phone leaves its church: it opens as a guest, the church gone from it', async () => {
      const page = phonePage
      // Bound to its device's user: the account menu has no other account.
      await pageApi(page, 'POST', '/api/settings/app_settings', {
        key: 'language',
        value: 'en',
      })
      await page.reload()
      await waitForApp(page)
      // On a phone the account is under More.
      await page.getByRole('button', { name: 'More' }).click()
      await page.getByRole('button', { name: 'Account' }).click()
      await expect(page.getByText('Log out')).toHaveCount(0)
      await page.getByRole('button', { name: 'Leave this church' }).click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Leave this church' })
        .click()

      await waitForApp(page)
      expect(await findSong(page, songTitleFromPhone)).toBeUndefined()
      const library = await pageApi(page, 'GET', '/api/songs/search?q=isus')
      expect((library.json?.data as unknown[]).length).toBeGreaterThan(0)
    })

    test('with no church, the web app opens as a guest on the Church Hub library', async ({
      browser,
    }) => {
      const guest = await browser.newContext()
      const page = await guest.newPage()
      await page.goto(publicApp.url)
      await waitForApp(page)

      const me = await pageApi(page, 'GET', '/api/auth/me')
      expect(me.json?.data).toMatchObject({ name: 'Super Admin' })
      const found = await pageApi(page, 'GET', '/api/songs/search?q=isus')
      expect((found.json?.data as unknown[]).length).toBeGreaterThan(0)
      const bibles = await pageApi(page, 'GET', '/api/bible/translations')
      expect((bibles.json?.data as unknown[]).length).toBeGreaterThan(0)

      // It presents on a display window it opens (its own screen, or a
      // second monitor): the display reaches the server of the page that
      // opened it.
      const screens = await pageApi(page, 'GET', '/api/screens')
      const [screen] = screens.json?.data as { id: number }[]
      const [display] = await Promise.all([
        page.waitForEvent('popup'),
        page.evaluate((id) => window.open(`/screen/${id}`), screen.id),
      ])
      await waitForApp(display)
      const song = await pageApi(page, 'POST', '/api/songs', {
        title: `E2E Guest Song ${stamp}`,
        slides: [{ content: '<p>Sung in the browser</p>', sortOrder: 0 }],
      })
      const songId = (song.json?.data as { id: number }).id
      await pageApi(page, 'POST', '/api/presentation/temporary-song', {
        songId,
        slideIndex: 0,
      })
      await expect(
        display.getByText('Sung in the browser', { exact: true }).last(),
      ).toBeVisible({ timeout: 15_000 })
      await guest.close()
    })
  })
