import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * T-149: after a SIGTERM to the desktop shell, the sidecar lived on
 * (reparented to launchd on macOS) and kept holding its port, so the next
 * launch found it taken. Only a normal quit stopped it.
 *
 * The shell starts the sidecar the way tauri-plugin-shell does: its stdin is
 * a pipe the shell holds, and CHURCH_HUB_EXIT_WITH_PARENT is set. Here a
 * stand-in shell starts the server that way and is then killed: the server
 * must stop and free its port.
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

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

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Starts the server with a piped stdin, prints its pid, then waits forever.
 * Detached: on Windows, Bun otherwise puts the child in a job that ends with
 * its parent, which Tauri's shell does not do.
 */
const STAND_IN_SHELL = `
const { spawn } = require('node:child_process')
const server = spawn('bun', ['apps/server/src/index.ts'], {
  detached: true,
  stdio: ['pipe', 'ignore', 'ignore'],
  env: { ...process.env, CHURCH_HUB_EXIT_WITH_PARENT: 'true' },
})
console.log('SERVER_PID=' + server.pid)
setInterval(() => {}, 1 << 30)
`

test.describe('The sidecar ends with the desktop shell (T-149)', () => {
  test('killing the shell stops the sidecar and frees its port', async ({}, testInfo) => {
    test.setTimeout(150_000)

    const dataDir = testInfo.outputPath('sidecar-data')
    mkdirSync(dataDir, { recursive: true })
    const port = await freePort()
    const shell = spawn('bun', ['-e', STAND_IN_SHELL], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_PATH: join(dataDir, 'app.db'),
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    // Read until the pid line: the first chunk may hold other output.
    const serverPid = await new Promise<number>((resolve, reject) => {
      let out = ''
      shell.stdout.on('data', (chunk) => {
        out += String(chunk)
        const match = out.match(/SERVER_PID=(\d+)/)
        if (match) resolve(Number(match[1]))
      })
      shell.once('exit', () =>
        reject(new Error(`the stand-in shell exited: ${out}`)),
      )
    })
    expect(isAlive(serverPid)).toBe(true)

    try {
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

      shell.kill('SIGTERM')

      await expect
        .poll(() => isAlive(serverPid), { timeout: 15_000, intervals: [250] })
        .toBe(false)
      const stillAnswering = await fetch(`${url}/ping`)
        .then(() => true)
        .catch(() => false)
      expect(stillAnswering).toBe(false)
    } finally {
      if (isAlive(serverPid)) process.kill(serverPid, 'SIGKILL')
      shell.kill('SIGKILL')
      // The server's database is ~150 MB: never leave it behind.
      rmSync(dataDir, { recursive: true, force: true, maxRetries: 10 })
    }
  })
})
