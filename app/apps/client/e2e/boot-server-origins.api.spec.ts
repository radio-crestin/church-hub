import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { freePort } from './helpers/free-port'
import { rawRequest } from './helpers/raw-request'
import { killAndWait, makeTempDir, removeTempDir } from './helpers/temp-dir'

/**
 * While the server boots, a stand-in answers /health, which the desktop
 * window polls from its own origin. Like the real server, it lets only the
 * app's origins read the answer cross-origin, never any website.
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const WEBVIEW = 'tauri://localhost'
const FOREIGN = 'https://foreign.example'

interface Probe {
  ready: boolean
  allowOrigin: string | undefined
}

async function probe(port: number, origin: string): Promise<Probe | null> {
  const res = await rawRequest(`http://127.0.0.1:${port}`, '/health', {
    headers: { Origin: origin },
  }).catch(() => null)
  if (!res || res.status !== 200) return null
  return {
    ready: (JSON.parse(res.body) as { ready: boolean }).ready,
    allowOrigin: res.headers['access-control-allow-origin'] as
      | string
      | undefined,
  }
}

test('the booting server answers /health cross-origin only to the app', async () => {
  test.setTimeout(150_000)
  const port = await freePort()
  const dataDir = makeTempDir('church-hub-boot-origins-')
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
    let booting: { webview: Probe; foreign: Probe } | null = null
    await expect
      .poll(
        async () => {
          const webview = await probe(port, WEBVIEW)
          const foreign = await probe(port, FOREIGN)
          if (webview?.ready === false && foreign?.ready === false) {
            booting = { webview, foreign }
          }
          return booting !== null
        },
        { timeout: 90_000, intervals: [100] },
      )
      .toBe(true)
    const seen = booting as unknown as { webview: Probe; foreign: Probe }
    expect(seen.webview.allowOrigin).toBe(WEBVIEW)
    expect(seen.foreign.allowOrigin).toBeUndefined()
  } finally {
    // The server's database is ~150 MB: never leave it behind.
    await killAndWait([server])
    removeTempDir(dataDir)
  }
})
