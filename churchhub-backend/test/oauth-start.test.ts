import { describe, expect, test } from 'bun:test'
import app from '../src/index'

/**
 * GET /auth/youtube and /auth/drive accept only a return target on an
 * allowed origin. Run with `bun test` from churchhub-backend/.
 */
const ALLOWED = 'http://localhost:3000'

const env = {
  YOUTUBE_CLIENT_ID: 'test-client',
  YOUTUBE_REDIRECT_URI: 'https://backend.test/auth/youtube/callback',
  YOUTUBE_SCOPE: 'scope',
  DRIVE_SCOPE: 'scope',
  DRIVE_REDIRECT_URI: 'https://backend.test/auth/drive/callback',
  COOKIE_ENCRYPTION_KEY: '00'.repeat(32),
  COOKIE_NAME: 'yt_oauth_state',
  COOKIE_MAX_AGE: 600,
  ALLOWED_ORIGINS: `${ALLOWED},http://localhost:3001`,
}

function start(flow: 'youtube' | 'drive', query: Record<string, string>) {
  const params = new URLSearchParams(query)
  return app.request(`https://backend.test/auth/${flow}?${params}`, {}, env)
}

describe.each(['youtube', 'drive'] as const)('GET /auth/%s', (flow) => {
  test('redirects to Google for a returnUrl on the allowed origin', async () => {
    const response = await start(flow, {
      origin: ALLOWED,
      mode: 'redirect',
      returnUrl: `${ALLOWED}/auth/callback`,
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toStartWith(
      'https://accounts.google.com/'
    )
  })

  test('refuses a returnUrl on another origin', async () => {
    for (const returnUrl of [
      'https://attacker.example/collect',
      'http://localhost:3001/auth/callback',
      'javascript:alert(1)',
      'not a url',
    ]) {
      const response = await start(flow, {
        origin: ALLOWED,
        mode: 'redirect',
        returnUrl,
      })
      expect(response.status).toBe(403)
      expect(response.headers.get('Set-Cookie')).toBeNull()
    }
  })

  test('refuses an unknown mode', async () => {
    const response = await start(flow, {
      origin: ALLOWED,
      mode: 'somethingElse',
      returnUrl: 'https://attacker.example/collect',
    })
    expect(response.status).toBe(403)
  })

  test('still starts the postMessage flow for an allowed origin', async () => {
    const response = await start(flow, { origin: ALLOWED })
    expect(response.status).toBe(302)
  })

  test('refuses an origin that is not allowed', async () => {
    const response = await start(flow, { origin: 'https://attacker.example' })
    expect(response.status).toBe(403)
  })
})
