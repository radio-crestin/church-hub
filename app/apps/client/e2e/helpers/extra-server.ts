import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type APIRequestContext,
  expect,
  request as playwrightRequest,
} from '@playwright/test'

import { makeTempDir, removeTempDir } from './temp-dir'
import { SERVER_PORT, SERVER_READY_LINE } from '../../playwright.config'

const APP_DIR = fileURLToPath(new URL('../../../..', import.meta.url))
const BOOT_TIMEOUT_MS = 240_000

/**
 * A second server for a spec that must restart one, e.g. to prove data
 * survives the start-up migrations. It has its own data folder and port
 * (this worker's server port + 600, never 3000), so the suite's server is untouched.
 * Boot it, stop it, change its database, boot it again on the same folder.
 * A spec that needs two (two computers) gives the second offset 601.
 */
export class ExtraServer {
  readonly dataDir = makeTempDir('church-hub-e2e-')
  readonly databasePath = join(this.dataDir, 'app.db')
  readonly port: number
  readonly baseURL: string

  constructor(portOffset: 600 | 601 = 600) {
    this.port = SERVER_PORT + portOffset
    this.baseURL = `http://localhost:${this.port}`
  }
  private process: ChildProcess | undefined
  private output = ''

  /** What the server has printed since its last start. */
  get log(): string {
    return this.output
  }

  /** `env`: more environment for the server, e.g. a stand-in API's address. */
  async start(env: Record<string, string> = {}): Promise<void> {
    if (this.port === 3000) throw new Error('port 3000 is the user dev server')
    const child = spawn(
      process.platform === 'win32' ? 'bun.exe' : 'bun',
      ['run', 'apps/server/src/index.ts'],
      {
        cwd: APP_DIR,
        env: {
          ...process.env,
          CHURCH_HUB_LISTEN_HOST: '127.0.0.1',
          NODE_ENV: 'production',
          CLIENT_DIST_PATH: 'apps/client/dist',
          CHURCH_HUB_DATA_DIR: this.dataDir,
          DATABASE_PATH: this.databasePath,
          PORT: String(this.port),
          ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    this.process = child
    this.output = ''
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `extra server not ready in time:\n${this.output.slice(-2000)}`,
            ),
          ),
        BOOT_TIMEOUT_MS,
      )
      const onData = (chunk: Buffer) => {
        this.output += chunk.toString()
        if (SERVER_READY_LINE.test(this.output)) {
          clearTimeout(timer)
          resolve()
        }
      }
      child.stdout?.on('data', onData)
      child.stderr?.on('data', onData)
      child.on('exit', (code) => {
        clearTimeout(timer)
        reject(
          new Error(
            `extra server exited (${code}):\n${this.output.slice(-2000)}`,
          ),
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

  /**
   * A session signed in as the install's super admin (passwordless on
   * localhost). Like the suite's auth setup, it marks the first-run
   * onboarding done, so pages open straight instead of on the wizard.
   */
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
    const onboarding = await api.post('/api/settings/app_settings', {
      data: { key: 'onboarding_pending', value: 'false' },
    })
    expect(onboarding.ok()).toBe(true)
    return api
  }

  /** A fresh install opens on its first-run onboarding; a page spec skips it. */
  async skipOnboarding(api: APIRequestContext): Promise<void> {
    const res = await api.post('/api/settings/app_settings', {
      data: { key: 'onboarding_pending', value: 'false' },
    })
    expect(res.ok()).toBe(true)
  }

  async dispose(): Promise<void> {
    await this.stop()
    removeTempDir(this.dataDir)
  }
}
