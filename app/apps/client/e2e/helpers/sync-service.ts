import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { makeTempDir, removeTempDir } from './temp-dir'
import { SYNC_POSTGRES_PORT, SYNC_SERVICE_PORT } from '../../playwright.config'

const BACKEND_DIR = fileURLToPath(
  new URL('../../../../../churchhub-backend', import.meta.url),
)
const READY_LINE = /\[sync\] Church Hub cloud sync \(\w+\) listening/
const POSTGRES_READY_LINE = /PGLiteSocketServer listening/
const BOOT_TIMEOUT_MS = 60_000
const INSTALL_TIMEOUT_MS = 300_000
const BUN = process.platform === 'win32' ? 'bun.exe' : 'bun'

/** The bucket the service writes to, on the spec's fake S3. */
export const SYNC_BUCKET = 'church-hub-sync'

/** The central state's database: SQLite (libsql) or PostgreSQL. */
export type SyncDatabase = 'sqlite' | 'postgresql'

/** Starts `args` under Bun in churchhub-backend; resolves once it prints `ready`. */
async function startProcess(
  name: string,
  args: string[],
  env: Record<string, string>,
  ready: RegExp,
): Promise<{ child: ChildProcess; output: () => string }> {
  let output = ''
  const child = spawn(BUN, args, {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${name} not ready:\n${output}`)),
      BOOT_TIMEOUT_MS,
    )
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (ready.test(output)) {
        clearTimeout(timer)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`${name} exited (${code}):\n${output}`))
    })
  })
  return { child, output: () => output }
}

async function stopProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill()
  await exited
}

/**
 * churchhub-backend's cloud sync service, self-hosted on Bun the way a
 * church would run it, with the spec's S3 stand-in as the bucket and its
 * central state in a SQLite file (libsql) or in PostgreSQL (PGlite served
 * over the Postgres wire protocol, reached through postgres.js like any
 * Postgres server). Its npm dependencies are installed on first use (they
 * live outside the app's workspace).
 */
export class SyncService {
  readonly dataDir = makeTempDir('church-hub-sync-')
  readonly url = `http://127.0.0.1:${SYNC_SERVICE_PORT}`
  private service: { child: ChildProcess; output: () => string } | undefined
  private postgres: ChildProcess | undefined

  get log(): string {
    return this.service?.output() ?? ''
  }

  private installDependencies(): void {
    const manifest = JSON.parse(
      readFileSync(join(BACKEND_DIR, 'package.json'), 'utf8'),
    ) as Record<string, Record<string, string> | undefined>
    const packages = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })
    if (
      packages.every((name) =>
        existsSync(join(BACKEND_DIR, 'node_modules', name)),
      )
    ) {
      return
    }
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

  /** A Postgres server on SYNC_POSTGRES_PORT; returns its URL. */
  private async startPostgres(): Promise<string> {
    const { child } = await startProcess(
      'PGlite server',
      [
        'node_modules/@electric-sql/pglite-socket/dist/scripts/server.js',
        `--db=${join(this.dataDir, 'postgres')}`,
        `--port=${SYNC_POSTGRES_PORT}`,
        '--host=127.0.0.1',
        '--max-connections=10',
      ],
      {},
      POSTGRES_READY_LINE,
    )
    this.postgres = child
    return `postgres://postgres@127.0.0.1:${SYNC_POSTGRES_PORT}/postgres`
  }

  /** `s3Endpoint`: the fake S3's address; it is also the public read URL. */
  async start(
    s3Endpoint: string,
    database: SyncDatabase,
    env: Record<string, string> = {},
  ) {
    this.installDependencies()
    const databaseUrl =
      database === 'postgresql'
        ? await this.startPostgres()
        : `file:${join(this.dataDir, 'sync.db')}`
    this.service = await startProcess(
      'sync service',
      ['src/selfhost/server.ts'],
      {
        PORT: String(SYNC_SERVICE_PORT),
        HOST: '127.0.0.1',
        SYNC_DATABASE_URL: databaseUrl,
        // PGlite serves one session at a time: one connection, queries queued.
        SYNC_DATABASE_POOL_MAX: '1',
        SYNC_TOKEN_SECRET: 'e2e-sync-token-secret',
        S3_ENDPOINT: s3Endpoint,
        S3_BUCKET: SYNC_BUCKET,
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'e2e-access-key',
        S3_SECRET_ACCESS_KEY: 'e2e-secret-key',
        S3_PUBLIC_URL: `${s3Endpoint}/${SYNC_BUCKET}`,
        ...env,
      },
      READY_LINE,
    )
  }

  async dispose(): Promise<void> {
    await stopProcess(this.service?.child)
    this.service = undefined
    await stopProcess(this.postgres)
    this.postgres = undefined
    removeTempDir(this.dataDir)
  }
}
