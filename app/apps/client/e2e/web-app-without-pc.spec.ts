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

/** The address the web app calls its server at (config WEB_APP_API_ORIGIN). */
const WEB_APP_API = 'http://church-pc.invalid'

interface ApiAnswer {
  status: number
  json: { data?: unknown } | null
}

/** A call to the page's own server, as the app makes it (through its tunnel). */
async function pageApi(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiAnswer> {
  return page.evaluate(
    async ({ api, method, path, body }) => {
      try {
        const response = await fetch(`${api}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        return { status: response.status, json: await response.json() }
      } catch {
        // Not started yet: the page can't reach its server.
        return { status: 0, json: null }
      }
    },
    { api: WEB_APP_API, method, path, body },
  )
}

/** A song's id on the page's own server (each database has its own ids). */
async function findSong(
  page: Page,
  title: string,
): Promise<number | undefined> {
  const found = await pageApi(
    page,
    'GET',
    `/api/songs/search?q=${encodeURIComponent(title)}`,
  )
  return (found.json?.data as { id: number; title: string }[]).find(
    (song) => song.title === title,
  )?.id
}

async function findSchedule(
  page: Page,
  title: string,
): Promise<number | undefined> {
  const schedules = await pageApi(page, 'GET', '/api/schedules')
  return (schedules.json?.data as { id: number; title: string }[]).find(
    (schedule) => schedule.title === title,
  )?.id
}

/** Waits for the web app to start its server and sign in. */
async function waitForApp(page: Page) {
  await expect
    .poll(async () => (await pageApi(page, 'GET', '/api/auth/me')).status, {
      timeout: 150_000,
      intervals: [1000],
    })
    .toBe(200)
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 })
}

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
      await guest.close()
    })
  })
