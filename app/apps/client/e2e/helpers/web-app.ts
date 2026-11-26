import { expect, type Page } from '@playwright/test'

/**
 * The web app (`bun run build:public`) in specs: its API is the server it
 * reached (the church PC over WebRTC, or its own in the browser, T-175),
 * called from the page the way the app calls it.
 */

/** The address the web app calls its server at (config WEB_APP_API_ORIGIN). */
const WEB_APP_API = 'http://church-pc.invalid'

export interface ApiAnswer {
  status: number
  json: { data?: unknown } | null
}

/** A call to the page's own server, as the app makes it (through its tunnel). */
export async function pageApi(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiAnswer> {
  const answer = page.evaluate(
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
  // A page that starts over (its server went away) is reached again later.
  return answer.catch(() => ({ status: 0, json: null }))
}

/** A song's id on the page's own server (each database has its own ids). */
export async function findSong(
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

export async function findSchedule(
  page: Page,
  title: string,
): Promise<number | undefined> {
  const schedules = await pageApi(page, 'GET', '/api/schedules')
  return (schedules.json?.data as { id: number; title: string }[]).find(
    (schedule) => schedule.title === title,
  )?.id
}

/** Queues searches on the page's server without waiting for them. */
export async function keepServerBusy(page: Page) {
  await page.evaluate((api) => {
    for (let i = 0; i < 40; i++) {
      fetch(`${api}/api/songs/search?q=isus+${i}`).catch(() => {})
    }
  }, WEB_APP_API)
}

/** Waits for the web app to start its server and sign in. */
export async function waitForApp(page: Page) {
  await expect
    .poll(async () => (await pageApi(page, 'GET', '/api/auth/me')).status, {
      timeout: 150_000,
      intervals: [1000],
    })
    .toBe(200)
  await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 })
}
