import { afterEach, beforeEach, expect, test } from 'bun:test'
import { BackupHarness, RETURN_URL } from './support/backupHarness'

/**
 * Cloud backup sign-in and sessions: every route needs a live access token,
 * a grant only opens a session with the PC's verifier, and signing out or
 * deleting the account refuses every token issued before. Run with
 * `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'Alice@Example.com' }

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness()
  harness.install()
})
afterEach(() => harness.restore())

const SIGNED_IN_ROUTES: [string, string][] = [
  ['GET', '/backup/key'],
  ['GET', '/backup/backups'],
  ['GET', '/backup/usage'],
  ['POST', '/backup/uploads'],
  ['POST', '/backup/uploads/AAAAAAAAAAAAAAAAAAAAAA/parts'],
  ['POST', '/backup/uploads/AAAAAAAAAAAAAAAAAAAAAA/complete'],
  ['DELETE', '/backup/uploads/AAAAAAAAAAAAAAAAAAAAAA'],
  ['POST', '/backup/backups/AAAAAAAAAAAAAAAAAAAAAA/download'],
  ['DELETE', '/backup/backups/AAAAAAAAAAAAAAAAAAAAAA'],
  ['DELETE', '/backup/session'],
  ['DELETE', '/backup/account'],
]

test('every account route refuses a missing, forged or foreign token', async () => {
  const { accessToken, refreshToken } = await harness.signIn(ALICE)
  const [payload] = accessToken.slice(5).split('.')
  const forged = `chba_${payload}.${'0'.repeat(64)}`
  for (const [method, path] of SIGNED_IN_ROUTES) {
    for (const token of [undefined, forged, refreshToken, 'cho_x.y']) {
      const response = await harness.json(path, method, {}, token)
      expect(`${method} ${path} ${response.status}`).toBe(`${method} ${path} 401`)
      expect(((await response.json()) as { code: string }).code).toBe('unauthorized')
    }
  }
})

test('a sign-in hands the PC a grant it can only use with its verifier', async () => {
  const session = await harness.signIn(ALICE)
  expect(session.nonce).toBeTruthy()
  expect(session.email).toBe('alice@example.com')
  expect(session.accessToken).toMatch(/^chba_/)
  expect(session.refreshToken).toMatch(/^chbr_/)

  const wrongVerifier = await harness.json('/backup/session', 'POST', {
    grant: session.grant,
    verifier: 'x'.repeat(43),
  })
  expect(wrongVerifier.status).toBe(401)

  const keyed = await harness.request('/backup/key', {}, session.accessToken)
  expect(keyed.status).toBe(200)
  expect(keyed.headers.get('Cache-Control')).toBe('no-store')
  const { key, keyVersion } = (await keyed.json()) as { key: string; keyVersion: number }
  expect(keyVersion).toBe(1)
  expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/)

  // The same account gets the same key after signing in again (a reinstall).
  const again = await harness.signIn(ALICE)
  const second = (await (await harness.request('/backup/key', {}, again.accessToken)).json()) as {
    key: string
  }
  expect(second.key).toBe(key)
  // Another account gets another.
  const bob = await harness.signIn({ sub: 'google-sub-bob', email: 'bob@example.com' })
  const third = (await (await harness.request('/backup/key', {}, bob.accessToken)).json()) as {
    key: string
  }
  expect(third.key).not.toBe(key)
})

test('the sign-in refuses a foreign return address, a bad nonce or challenge', async () => {
  const challenge = 'c'.repeat(43)
  const nonce = 'n'.repeat(24)
  for (const query of [
    { returnUrl: 'https://evil.test/collect', nonce, challenge },
    { returnUrl: RETURN_URL, nonce: 'short', challenge },
    { returnUrl: RETURN_URL, nonce, challenge: 'short' },
  ]) {
    const response = await harness.request(`/backup/sign-in?${new URLSearchParams(query)}`)
    expect(response.status).toBe(400)
  }
  const tampered = await harness.request('/backup/callback?code=x&state=bogus')
  expect(tampered.status).toBe(400)
})

test('a refresh token rotates and keeps working until the account signs out', async () => {
  const first = await harness.signIn(ALICE)
  const refreshed = await harness.json('/backup/session/refresh', 'POST', {
    refreshToken: first.refreshToken,
  })
  expect(refreshed.status).toBe(200)
  const second = (await refreshed.json()) as { accessToken: string; refreshToken: string }
  expect(second.refreshToken).not.toBe(first.refreshToken)
  expect((await harness.request('/backup/backups', {}, second.accessToken)).status).toBe(200)

  // Tokens issued in the same millisecond as the sign-out would survive it.
  await Bun.sleep(2)
  const signedOut = await harness.request('/backup/session', { method: 'DELETE' }, second.accessToken)
  expect(signedOut.status).toBe(200)
  for (const token of [first.accessToken, second.accessToken]) {
    expect((await harness.request('/backup/backups', {}, token)).status).toBe(401)
  }
  for (const refreshToken of [first.refreshToken, second.refreshToken]) {
    const response = await harness.json('/backup/session/refresh', 'POST', { refreshToken })
    expect(response.status).toBe(401)
  }
  await Bun.sleep(2)
  const back = await harness.signIn(ALICE)
  expect((await harness.request('/backup/backups', {}, back.accessToken)).status).toBe(200)
})

test('a reused refresh token is refused and ends every session of the account', async () => {
  const pc1 = await harness.signIn(ALICE)
  const pc2 = await harness.signIn(ALICE)
  const rotated = await harness.json('/backup/session/refresh', 'POST', {
    refreshToken: pc1.refreshToken,
  })
  const fresh = (await rotated.json()) as { accessToken: string; refreshToken: string }
  expect((await harness.request('/backup/backups', {}, fresh.accessToken)).status).toBe(200)

  // The old refresh token again: a copy was used (theft).
  await Bun.sleep(2)
  const reused = await harness.json('/backup/session/refresh', 'POST', {
    refreshToken: pc1.refreshToken,
  })
  expect(reused.status).toBe(401)
  for (const token of [fresh.accessToken, pc2.accessToken]) {
    expect((await harness.request('/backup/backups', {}, token)).status).toBe(401)
  }
  for (const refreshToken of [fresh.refreshToken, pc2.refreshToken]) {
    const again = await harness.json('/backup/session/refresh', 'POST', { refreshToken })
    expect(again.status).toBe(401)
  }
})

test('signing out one PC keeps the account’s other PCs signed in', async () => {
  const pc1 = await harness.signIn(ALICE)
  const pc2 = await harness.signIn(ALICE)
  await harness.request('/backup/session', { method: 'DELETE' }, pc1.accessToken)
  expect((await harness.request('/backup/backups', {}, pc1.accessToken)).status).toBe(401)
  expect((await harness.request('/backup/backups', {}, pc2.accessToken)).status).toBe(200)
})

test('an expired access token is refused', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const realNow = Date.now
  Date.now = () => realNow() + 61 * 60 * 1000
  try {
    expect((await harness.request('/backup/backups', {}, accessToken)).status).toBe(401)
  } finally {
    Date.now = realNow
  }
})

test('without its settings the service answers 503 not_configured', async () => {
  harness.env = { ...harness.env, BACKUP_KEY_SECRET: undefined }
  const response = await harness.request('/backup/backups')
  expect(response.status).toBe(503)
  expect(((await response.json()) as { code: string }).code).toBe('not_configured')
})
