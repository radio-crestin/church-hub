import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  expect,
  request as playwrightRequest,
} from '@playwright/test'

import { SERVER_READY_LINE } from '../../playwright.config'

const APP_DIR = fileURLToPath(new URL('../../../..', import.meta.url))
const BOOT_TIMEOUT_MS = 240_000

/**
 * A second server for a spec that must restart one, e.g. to prove data
 * survives the start-up migrations. It has its own data folder and port
 * (the suite's port + 600, never 3000), so the suite's server is untouched.
 * Boot it, stop it, change its database, boot it again on the same folder.
 */
export class ExtraServer {
  readonly dataDir = mkdtempSync(join(tmpdir(), 'church-hub-e2e-'))
  readonly databasePath = join(this.dataDir, 'app.db')
  readonly port = Number(process.env.TEST_PORT ?? '3099') + 600
  readonly baseURL = `http://localhost:${this.port}`
  private process: ChildProcess | undefined

  async start(): Promise<void> {
    if (this.port === 3000) throw new Error('port 3000 is the user dev server')
    const child = spawn(
      process.platform === 'win32' ? 'bun.exe' : 'bun',
      ['run', 'apps/server/src/index.ts'],
      {
        cwd: APP_DIR,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          CLIENT_DIST_PATH: 'apps/client/dist',
          CHURCH_HUB_DATA_DIR: this.dataDir,
          DATABASE_PATH: this.databasePath,
          PORT: String(this.port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    this.process = child
    let output = ''
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `extra server not ready in time:\n${output.slice(-2000)}`,
            ),
          ),
        BOOT_TIMEOUT_MS,
      )
      const onData = (chunk: Buffer) => {
        output += chunk.toString()
        if (SERVER_READY_LINE.test(output)) {
          clearTimeout(timer)
          resolve()
        }
      }
      child.stdout?.on('data', onData)
      child.stderr?.on('data', onData)
      child.on('exit', (code) => {
        clearTimeout(timer)
        reject(
          new Error(`extra server exited (${code}):\n${output.slice(-2000)}`),
        )
      })
    })
  }

  async stop(): Promise<void> {
    const child = this.process
    this.process = undefined
    if (!child || child.exitCode !== null) return
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill('SIGTERM')
    await exited
  }

  /** A session signed in as the install's super admin (passwordless on localhost). */
  async adminRequest(): Promise<APIRequestContext> {
    const api = await playwrightRequest.newContext({ baseURL: this.baseURL })
    const users = (await (await api.get('/api/auth/local-users')).json())
      .data as {
      id: number
      isSuperAdmin: boolean
    }[]
    const admin = users.find((u) => u.isSuperAdmin)
    expect(admin, 'a fresh install has a super admin').toBeTruthy()
    const login = await api.post('/api/auth/login', {
      data: { userId: admin!.id },
    })
    expect(login.ok()).toBe(true)
    return api
  }

  async dispose(): Promise<void> {
    await this.stop()
    rmSync(this.dataDir, { recursive: true, force: true, maxRetries: 3 })
  }
}
