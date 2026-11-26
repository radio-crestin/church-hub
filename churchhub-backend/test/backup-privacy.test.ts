import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { applyRetention } from '../src/backup/account/applyRetention'
import { limitInMemory } from '../src/backup/rateLimit'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * What cloud backup never lets out (tokens, emails, object keys in answers
 * and logs), its rate limits, retention and docs. Run with `bun test` from
 * churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }

let harness: BackupHarness
let lines: string[]
let spies: { mockRestore(): void }[]

beforeEach(() => {
  harness = new BackupHarness()
  harness.install()
  lines = []
  const capture = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  }
  spies = [
    spyOn(console, 'error').mockImplementation(capture),
    spyOn(console, 'log').mockImplementation(capture),
    spyOn(console, 'warn').mockImplementation(capture),
  ]
})
afterEach(() => {
  for (const spy of spies) spy.mockRestore()
  harness.restore()
})

test('a failing store logs and answers without tokens, emails or object keys', async () => {
  const { accessToken, refreshToken } = await harness.signIn(ALICE)
  const { backupId } = await harness.upload(accessToken, new Uint8Array(10))
  harness.s3.failWith = 500
  const answers: string[] = []
  for (const [method, path] of [
    ['GET', '/backup/backups'],
    ['POST', `/backup/backups/${backupId}/download`],
    ['DELETE', '/backup/account'],
  ]) {
    const response = await harness.json(path, method, {}, accessToken)
    expect(response.status).toBe(500)
    answers.push(await response.text())
  }
  const refreshed = await harness.json('/backup/session/refresh', 'POST', { refreshToken })
  answers.push(await refreshed.text())

  const everything = [...answers, ...lines].join('\n')
  expect(lines.join('\n')).toContain('[backup] request failed')
  for (const secret of [accessToken, refreshToken, ALICE.email, ALICE.sub, backupId, 'accounts/']) {
    expect(everything).not.toContain(secret)
  }
})

test('a refused sign-in names neither the code nor the account', async () => {
  const session = await harness.signIn(ALICE)
  const replay = await harness.json('/backup/session', 'POST', {
    grant: session.grant,
    verifier: 'v'.repeat(43),
  })
  const text = await replay.text()
  expect(text).not.toContain(ALICE.email)
  expect(text).not.toContain(session.grant)
  expect(lines.join('\n')).not.toContain(ALICE.email)
})

test('over the per-IP limit the service answers 429', async () => {
  harness.env = backupEnv({
    BACKUP_RATE_LIMITER: { limit: async () => ({ success: false }) },
  })
  const response = await harness.request('/backup/backups')
  expect(response.status).toBe(429)
  expect(((await response.json()) as { code: string }).code).toBe('rate_limited')
})

test('over the per-account limit the service answers 429', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  harness.env = backupEnv({
    BACKUP_ACCOUNT_RATE_LIMITER: { limit: async () => ({ success: false }) },
  })
  expect((await harness.request('/backup/backups', {}, accessToken)).status).toBe(429)
})

test('without a binding (Node) the limit is kept in memory, per minute', () => {
  const now = 1_000_000
  for (let i = 0; i < 3; i++) expect(limitInMemory('ip:test', 3, now)).toBe(true)
  expect(limitInMemory('ip:test', 3, now + 1)).toBe(false)
  expect(limitInMemory('ip:other', 3, now + 1)).toBe(true)
  expect(limitInMemory('ip:test', 3, now + 60_000)).toBe(true)
})

test('a body over 16 KiB is refused', async () => {
  const response = await harness.request('/backup/session', {
    method: 'POST',
    body: JSON.stringify({ grant: 'x'.repeat(20_000) }),
  })
  expect(response.status).toBe(413)
})

test('retention: the newest three, one a day for a week, one a week for five', () => {
  const day = 24 * 60 * 60 * 1000
  const now = 100 * day
  const backup = (ageMs: number, id: string) => ({
    id,
    sizeBytes: 1,
    createdAt: now - ageMs,
    appVersion: '1',
    keyVersion: 1,
  })
  const backups = [
    backup(0, 'a'),
    backup(1000, 'b'),
    backup(2000, 'c'),
    backup(3000, 'same-day'),
    backup(1.5 * day, 'yesterday'),
    backup(1.6 * day, 'yesterday-older'),
    backup(10 * day, 'week-1'),
    backup(11 * day, 'week-1-older'),
    backup(60 * day, 'too-old'),
  ]
  const { kept, removed } = applyRetention(backups, 12, now)
  expect(kept.map((b) => b.id)).toEqual(['a', 'b', 'c', 'yesterday', 'week-1'])
  expect(removed.map((b) => b.id)).toEqual([
    'same-day',
    'yesterday-older',
    'week-1-older',
    'too-old',
  ])
  expect(applyRetention(backups, 2, now).kept.map((b) => b.id)).toEqual(['a', 'b'])
})

test('the docs page loads a pinned Scalar build with its integrity hash', async () => {
  const docs = await (await harness.request('/backup/docs')).text()
  expect(docs).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+"/)
  expect(docs).toContain('integrity="sha384-')
  const spec = (await (await harness.request('/backup/openapi.json')).json()) as {
    paths: Record<string, unknown>
  }
  expect(Object.keys(spec.paths)).toContain('/backup/uploads/{backupId}/parts')
  expect(Object.keys(spec.paths)).toContain('/backup/account')
})
