import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SYNC_SERVICE_PORT } from '../../playwright.config'

const BACKEND_DIR = fileURLToPath(
  new URL('../../../../../churchhub-backend', import.meta.url),
)
const READY_LINE = /\[server\] Church Hub backend listening/
const BOOT_TIMEOUT_MS = 60_000
const INSTALL_TIMEOUT_MS = 300_000

/** The bucket the service writes to, on the spec's fake S3. */
export const SYNC_BUCKET = 'church-hub-sync'

/**
 * churchhub-backend, self-hosted on Bun the way a church would run it
 * (its Node entry), with the spec's S3 stand-in as its only storage: the
 * public bucket, holding each church's encrypted state too (no database).
 * Its npm dependencies are installed on first use (they live outside the
 * app's workspace).
 */
export class SyncService {
  readonly url = `http://127.0.0.1:${SYNC_SERVICE_PORT}`
  private process: ChildProcess | undefined
  private output = ''

  get log(): string {
    return this.output
  }

  private installDependencies(): void {
    const manifest = JSON.parse(
      readFileSync(join(BACKEND_DIR, 'package.json'), 'utf8'),
    ) as Record<string, Record<string, string> | undefined>
    const packages = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })
    const installed = (name: string) =>
      existsSync(join(BACKEND_DIR, 'node_modules', name))
    if (packages.every(installed)) return
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const result = spawnSync(npm, ['ci', '--no-audit', '--no-fund'], {
      cwd: BACKEND_DIR,
      stdio: 'pipe',
      timeout: INSTALL_TIMEOUT_MS,
      // npm.cmd is a batch file: Windows runs it only through a shell.
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) {
      throw new Error(
        `npm ci in churchhub-backend failed:\n${result.stderr?.toString()}`,
      )
    }
  }

  /** `s3Endpoint`: the fake S3's address; it is also the public read URL. */
  async start(s3Endpoint: string, env: Record<string, string> = {}) {
    this.installDependencies()
    const child = spawn(
      process.platform === 'win32' ? 'bun.exe' : 'bun',
      ['src/node/server.ts'],
      {
        cwd: BACKEND_DIR,
        env: {
          ...process.env,
          PORT: String(SYNC_SERVICE_PORT),
          HOST: '127.0.0.1',
          SYNC_SECRET: 'e2e-sync-secret',
          S3_ENDPOINT: s3Endpoint,
          S3_BUCKET: SYNC_BUCKET,
          S3_REGION: 'us-east-1',
          S3_ACCESS_KEY_ID: 'e2e-access-key',
          S3_SECRET_ACCESS_KEY: 'e2e-secret-key',
          S3_PUBLIC_URL: `${s3Endpoint}/${SYNC_BUCKET}`,
          // Every spec registers its churches from 127.0.0.1.
          SYNC_RATE_LIMIT_PER_MINUTE: '1000',
          ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    this.process = child
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`sync service not ready:\n${this.output}`)),
        BOOT_TIMEOUT_MS,
      )
      const onData = (chunk: Buffer) => {
        this.output += chunk.toString()
        if (READY_LINE.test(this.output)) {
          clearTimeout(timer)
          resolve()
        }
      }
      child.stdout?.on('data', onData)
      child.stderr?.on('data', onData)
      child.on('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`sync service exited (${code}):\n${this.output}`))
      })
    })
  }

  async dispose(): Promise<void> {
    const child = this.process
    this.process = undefined
    if (child && child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      await exited
    }
  }
}
