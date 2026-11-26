import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/** A Google account the stand-in signs in as. */
export interface FakeGoogleAccount {
  sub: string
  email: string
}

/**
 * Google's OAuth endpoints for specs: the account chooser answers at once
 * as `account` (what the user would have picked), the token endpoint swaps
 * the code for an access token, and userinfo names the verified account.
 * The sync service is pointed at it (GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL,
 * GOOGLE_USERINFO_URL).
 */
export class FakeGoogle {
  account: FakeGoogleAccount = {
    sub: 'google-owner-1',
    email: 'owner@example.com',
  }
  private readonly codes = new Map<string, FakeGoogleAccount>()
  private readonly tokens = new Map<string, FakeGoogleAccount>()
  private server: Server | undefined

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname === '/authorize') {
        const code = randomBytes(12).toString('hex')
        this.codes.set(code, this.account)
        const back = new URL(url.searchParams.get('redirect_uri') ?? '')
        back.searchParams.set('code', code)
        back.searchParams.set('state', url.searchParams.get('state') ?? '')
        res.writeHead(302, { Location: back.toString() }).end()
        return
      }
      if (url.pathname === '/token' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          const code = new URLSearchParams(body).get('code') ?? ''
          const account = this.codes.get(code)
          this.codes.delete(code)
          if (!account) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid_grant' }))
            return
          }
          const token = randomBytes(12).toString('hex')
          this.tokens.set(token, account)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              access_token: token,
              expires_in: 3600,
              token_type: 'Bearer',
              scope: 'openid email',
            }),
          )
        })
        return
      }
      if (url.pathname === '/userinfo') {
        const token = req.headers.authorization?.replace(/^Bearer /, '') ?? ''
        const account = this.tokens.get(token)
        res.writeHead(account ? 200 : 401, {
          'Content-Type': 'application/json',
        })
        res.end(
          JSON.stringify(account ? { ...account, email_verified: true } : {}),
        )
        return
      }
      res.writeHead(404).end()
    })
    await new Promise<void>((resolve) =>
      this.server?.listen(0, '127.0.0.1', resolve),
    )
  }

  get url(): string {
    const { port } = this.server?.address() as AddressInfo
    return `http://127.0.0.1:${port}`
  }

  /** The sync service's settings that send its sign-ins here. */
  get serviceEnv(): Record<string, string> {
    return {
      YOUTUBE_CLIENT_ID: 'e2e-client-id',
      YOUTUBE_CLIENT_SECRET: 'e2e-client-secret',
      GOOGLE_AUTH_URL: `${this.url}/authorize`,
      GOOGLE_TOKEN_URL: `${this.url}/token`,
      GOOGLE_USERINFO_URL: `${this.url}/userinfo`,
    }
  }

  async stop(): Promise<void> {
    await new Promise((resolve) => this.server?.close(resolve))
  }
}
