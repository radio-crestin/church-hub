import { type ChildProcess, spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'

/**
 * T-096: with several Church Hub apps open, a song shown in a list said it
 * doesn't exist. The installed app and the dev server both used port 3000,
 * and each kills whatever holds its port on start. The older app's window
 * stayed open on its list, but its requests reached the newer app's server
 * and its own database, where that id is missing (or is another song). The
 * dev server now has its own port (3001); any two apps on one port (e.g. two
 * installed builds) still meet this, and the window must handle it.
 *
 * Here the takeover is a second server on a copy of the database made before
 * the song existed, and the window's API requests are sent to it.
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const NOT_FOUND_TOAST =
  /Song not found|Cântarea nu a fost găsită|no longer exists|nu mai există/i

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })
}

/** Another Church Hub: its own server on its own database. */
async function startOtherChurchHub(databasePath: string) {
  const port = await freePort()
  const server = spawn('bun', ['run', 'apps/server/src/index.ts'], {
    cwd: APP_ROOT,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath },
    stdio: 'ignore',
  })
  const url = `http://localhost:${port}`
  await expect
    .poll(
      async () => {
        const res = await fetch(`${url}/health`).catch(() => null)
        return res?.ok
          ? ((await res.json()) as { ready: boolean }).ready
          : false
      },
      { timeout: 90_000, intervals: [500] },
    )
    .toBe(true)
  return { server, url }
}

/** What the window sees once the other app owns its port. */
async function sendApiRequestsTo(page: Page, otherUrl: string) {
  await page.route('**/api/**', async (route) => {
    const { pathname, search } = new URL(route.request().url())
    const response = await route.fetch({
      url: `${otherUrl}${pathname}${search}`,
    })
    await route.fulfill({ response })
  })
}

test.describe('Opening a song with several Church Hub apps (T-096)', () => {
  let otherChurchHub: ChildProcess | undefined

  test.afterEach(() => {
    otherChurchHub?.kill()
    otherChurchHub = undefined
  })

  test('a listed song never says it does not exist after another app takes the port', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(150_000)

    // The other app's database: a copy made before our song exists.
    const otherDir = testInfo.outputPath('other-church-hub')
    mkdirSync(otherDir, { recursive: true })
    const otherDatabase = join(otherDir, 'app.db')
    const exported = await request.post('/api/database/export', {
      data: { destinationPath: otherDatabase },
    })
    expect(exported.ok()).toBe(true)

    const title = `T096 only here ${Math.random().toString(36).slice(2, 8)}`
    const created = await request.post('/api/songs', {
      data: {
        title,
        slides: [{ content: `Lyric of ${title}`, sortOrder: 0, label: 'V1' }],
      },
    })
    expect(created.ok()).toBe(true)
    const songId = (await created.json()).data.id as number

    const other = await startOtherChurchHub(otherDatabase)
    otherChurchHub = other.server

    try {
      await page.goto(`/songs?q=${encodeURIComponent(title)}`)
      const row = page.locator('h3', { hasText: title }).first()
      await expect(row).toBeVisible({ timeout: 15000 })
      await page.screenshot({ path: testInfo.outputPath('1-listed.png') })

      await sendApiRequestsTo(page, other.url)
      await row.click()

      const notFound = page.getByText(NOT_FOUND_TOAST).first()
      const notice = page.getByTestId('server-changed-notice')
      await expect(notFound.or(notice)).toBeVisible({ timeout: 15000 })
      await page.waitForTimeout(700) // let a toast finish sliding in
      await page.screenshot({ path: testInfo.outputPath('2-after-click.png') })

      // Never "doesn't exist" for a song the window listed (checked at once:
      // a retrying check would wait for the toast to fade). The window says it
      // now talks to another app, and is back on the songs list.
      expect(await notFound.count()).toBe(0)
      await expect(notice).toBeVisible()
      await expect(page).toHaveURL(/\/songs\/?(\?|$)/)
      await page.waitForTimeout(1500)
      expect(await notFound.count()).toBe(0)

      // What it lists now opens.
      await page.locator('button:has(h3)').first().click()
      await expect(page.getByTestId('song-slide-0')).toBeVisible({
        timeout: 10000,
      })
      await expect(notFound).toHaveCount(0)
      await page.screenshot({
        path: testInfo.outputPath('3-listed-song-opens.png'),
      })
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await request.delete(`/api/songs/${songId}`)
    }
  })
})
