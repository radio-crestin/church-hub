import { type ChildProcess, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import { freePort } from './helpers/free-port'
import { killAndWait, makeTempDir, removeTempDir } from './helpers/temp-dir'

/**
 * T-099: a starting server kills a stale server that still holds its port.
 * On macOS and Linux it looked the port up with a bare `lsof -ti :port`,
 * which also lists every process connected to it as a client, and those
 * were `kill -9`ed too: on the Linux test VM, the smoke test polling the
 * port; in the app, whatever still talked to the old server. Only the
 * process listening on the port may be killed.
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Runs `code` in bun and resolves once it prints its first line. */
function startBun(code: string): Promise<ChildProcess> {
  const child = spawn('bun', ['-e', code], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return new Promise((resolve, reject) => {
    child.stdout?.once('data', () => resolve(child))
    child.once('exit', (code) => reject(new Error(`exited with ${code}`)))
  })
}

function isAlive(pid: number | undefined): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test.describe('A starting server frees its port (T-099)', () => {
  test('kills the stale server on its port, not the clients connected to it', async () => {
    test.setTimeout(120_000)
    const port = await freePort()
    const dataDir = makeTempDir('church-hub-port-')
    const children: ChildProcess[] = []

    try {
      // A stale server holding the port, and a client connected to it.
      const stale = await startBun(
        `Bun.listen({ hostname: '0.0.0.0', port: ${port}, socket: { data() {} } }); console.log('listening')`,
      )
      children.push(stale)
      const client = await startBun(
        `const s = require('node:net').connect(${port}, '127.0.0.1', () => console.log('connected'))
         s.on('error', () => {}); setInterval(() => {}, 1 << 30)`,
      )
      children.push(client)

      const server = spawn('bun', ['run', 'apps/server/src/index.ts'], {
        cwd: APP_ROOT,
        env: {
          ...process.env,
          PORT: String(port),
          DATABASE_PATH: join(dataDir, 'app.db'),
        },
        stdio: 'ignore',
      })
      children.push(server)

      await expect
        .poll(
          async () => {
            const res = await fetch(`http://localhost:${port}/health`).catch(
              () => null,
            )
            return res?.ok
              ? ((await res.json()) as { ready: boolean }).ready
              : false
          },
          { timeout: 90_000, intervals: [500] },
        )
        .toBe(true)

      expect(isAlive(stale.pid), 'the stale server was killed').toBe(false)
      expect(isAlive(client.pid), 'the connected client was left alone').toBe(
        true,
      )
    } finally {
      // The server's database is ~147 MB: never leave it behind.
      await killAndWait(children)
      removeTempDir(dataDir)
    }
  })
})
