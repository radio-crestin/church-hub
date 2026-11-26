import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { freePort } from './helpers/free-port'
import { rawRequest } from './helpers/raw-request'
import { killAndWait, makeTempDir, removeTempDir } from './helpers/temp-dir'

/**
 * A browser that opens Church Hub while the server is still starting (a phone
 * on the church Wi-Fi) gets a loading page with the current step, in the
 * app's language, which reloads once the server is ready; never the boot
 * server's bare JSON. API calls still get the JSON.
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

async function isBooting(baseURL: string): Promise<boolean> {
  const res = await rawRequest(baseURL, '/health').catch(() => null)
  if (!res || res.status !== 200) return false
  return (JSON.parse(res.body) as { ready: boolean }).ready === false
}

test('a page opened while the server starts shows the loading page, then reloads', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const port = await freePort()
  const baseURL = `http://127.0.0.1:${port}`
  const dataDir = makeTempDir('church-hub-boot-page-')
  // A first start: migrations and seeding keep the boot server up a while.
  const server = spawn('bun', ['run', 'apps/server/src/index.ts'], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(dataDir, 'app.db'),
      CHURCH_HUB_LISTEN_HOST: '127.0.0.1',
    },
    stdio: 'ignore',
  })

  try {
    await expect
      .poll(() => isBooting(baseURL), { timeout: 90_000, intervals: [100] })
      .toBe(true)

    const api = await rawRequest(baseURL, '/api/songs', {
      headers: { Accept: 'application/json' },
    })
    expect(api.status).toBe(503)
    expect(api.headers['content-type']).toContain('application/json')

    await page.addInitScript(() =>
      localStorage.setItem('church-hub-language', 'ro'),
    )
    await page.goto(`${baseURL}/`)
    await expect(page.locator('#title')).toHaveText('Church Hub pornește')
    await expect(page.locator('#step')).not.toBeEmpty()

    // Ready: the page reloads into whatever the real server serves.
    await expect(page.locator('#title')).toHaveCount(0, { timeout: 120_000 })
  } finally {
    // The server's database is ~150 MB: never leave it behind.
    await killAndWait([server])
    removeTempDir(dataDir)
  }
})
