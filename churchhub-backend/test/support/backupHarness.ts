import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import backup from '../../src/routes/backup'
import type { Bindings } from '../../src/types'
import { MemoryS3 } from './memoryS3'

export const RETURN_URL = 'http://localhost:4100/api/backup/cloud/callback'
const allow = { limit: async () => ({ success: true }) }

export interface GoogleAccount {
  sub: string
  email: string
}

/** The backup service's settings for a test, its store and Google stand-in. */
export function backupEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    BACKUP_SECRET: 'test-backup-secret',
    BACKUP_KEY_SECRET: 'test-backup-key-secret',
    BACKUP_S3_ENDPOINT: 'https://s3.test',
    BACKUP_S3_BUCKET: 'backups',
    BACKUP_S3_REGION: 'us-east-1',
    BACKUP_S3_ACCESS_KEY_ID: 'test-access-key',
    BACKUP_S3_SECRET_ACCESS_KEY: 'test-secret-key',
    YOUTUBE_CLIENT_ID: 'test-client',
    YOUTUBE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_AUTH_URL: 'https://google.test/authorize',
    GOOGLE_TOKEN_URL: 'https://google.test/token',
    GOOGLE_USERINFO_URL: 'https://google.test/userinfo',
    BACKUP_RATE_LIMITER: allow,
    BACKUP_ACCOUNT_RATE_LIMITER: allow,
    ...overrides,
  } as unknown as Bindings
}

/**
 * The /backup routes with an in-memory S3 and Google behind `fetch`, and
 * the steps a PC takes: sign in, upload, call the API.
 */
export class BackupHarness {
  readonly s3 = new MemoryS3()
  readonly app = new Hono<{ Bindings: Bindings }>().route('/', backup)
  private readonly codes = new Map<string, GoogleAccount>()
  private readonly googleTokens = new Map<string, GoogleAccount>()
  private realFetch = globalThis.fetch

  constructor(public env: Bindings = backupEnv()) {}

  install(): void {
    this.realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const { host } = new URL(request.url)
      if (host === 's3.test') return this.s3.handle(request)
      if (host === 'google.test') return this.google(request)
      throw new Error(`unexpected fetch to ${host}`)
    }) as typeof fetch
  }

  restore(): void {
    globalThis.fetch = this.realFetch
  }

  private async google(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/token') {
      const code = new URLSearchParams(await request.text()).get('code') ?? ''
      const account = this.codes.get(code)
      if (!account) return Response.json({ error: 'invalid_grant' }, { status: 400 })
      const token = randomBytes(8).toString('hex')
      this.googleTokens.set(token, account)
      return Response.json({ access_token: token, expires_in: 3600, token_type: 'Bearer', scope: 'openid email' })
    }
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const account = this.googleTokens.get(token)
    return account
      ? Response.json({ ...account, email_verified: true })
      : new Response(null, { status: 401 })
  }

  request(path: string, init: RequestInit = {}, token?: string) {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (init.body) headers.set('Content-Type', 'application/json')
    return this.app.request(`https://backend.test${path}`, { ...init, headers }, this.env)
  }

  json(path: string, method: string, body: unknown, token?: string) {
    return this.request(path, { method, body: JSON.stringify(body) }, token)
  }

  /** The browser's trip through Google, as the PC starts and ends it. */
  async signIn(account: GoogleAccount, verifier = randomBytes(32).toString('base64url')) {
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const nonce = randomBytes(18).toString('base64url')
    const start = await this.request(
      `/backup/sign-in?${new URLSearchParams({ returnUrl: RETURN_URL, nonce, challenge })}`
    )
    const google = new URL(start.headers.get('Location') ?? '')
    const code = randomBytes(8).toString('hex')
    this.codes.set(code, account)
    const callback = await this.request(
      `/backup/callback?${new URLSearchParams({ code, state: google.searchParams.get('state') ?? '' })}`
    )
    const back = new URL(callback.headers.get('Location') ?? '')
    const grant = back.searchParams.get('grant') ?? ''
    const response = await this.json('/backup/session', 'POST', { grant, verifier })
    const session = (await response.json()) as {
      accessToken: string
      refreshToken: string
      email: string
    }
    return { ...session, grant, verifier, nonce: back.searchParams.get('nonce') }
  }

  /** Starts, uploads in parts through the presigned URLs and completes. */
  async upload(token: string, bytes: Uint8Array) {
    const started = await this.json(
      '/backup/uploads',
      'POST',
      { sizeBytes: bytes.length, appVersion: '0.2.0', keyVersion: 1 },
      token
    )
    const { backupId, partSize, partCount } = (await started.json()) as {
      backupId: string
      partSize: number
      partCount: number
    }
    const numbers = Array.from({ length: partCount }, (_, i) => i + 1)
    const presigned = await this.json(
      `/backup/uploads/${backupId}/parts`,
      'POST',
      { partNumbers: numbers },
      token
    )
    const { parts } = (await presigned.json()) as {
      parts: { partNumber: number; url: string }[]
    }
    for (const part of parts) {
      const start = (part.partNumber - 1) * partSize
      await fetch(part.url, { method: 'PUT', body: bytes.slice(start, start + partSize) })
    }
    const done = await this.request(`/backup/uploads/${backupId}/complete`, { method: 'POST' }, token)
    return { backupId, done }
  }
}
