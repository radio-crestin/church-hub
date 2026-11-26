import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { createMemoryRateLimiter } from '../src/node/createMemoryRateLimiter'
import { resolveClientIp } from '../src/node/resolveClientIp'
import { withClientIp } from '../src/node/withClientIp'
import { runBackupMaintenance } from '../src/backup/runBackupMaintenance'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * What cloud backup never lets out (tokens, emails, object keys in answers
 * and logs), its rate limits and docs. Run with `bun test` from
 * churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }
/** An email address; a package path like `name@1.0.20` or `@scope/name` is not one. */
const EMAIL = /[\w.+-]+@[a-z][\w-]*(\.[a-z][\w-]*)+/i

test('the email pattern matches emails, not dependency paths', () => {
  expect(ALICE.email).toMatch(EMAIL)
  for (const path of [
    '/Users/x/.bun/install/cache/links/aws4fetch@1.0.20-abc123/node_modules/aws4fetch/dist/aws4fetch.esm.mjs',
    '/app/node_modules/@hono/node-server/dist/index.mjs',
    '/cache/links/@hono+node-server@1.19.4-f00/node_modules/@hono/node-server/dist/index.mjs',
  ]) {
    expect(path).not.toMatch(EMAIL)
  }
})

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

test('a failing account’s upkeep and request logs name no key, URL or email', async () => {
  const alice = await harness.signIn(ALICE)
  await harness.upload(alice.accessToken, new Uint8Array(10), [new Uint8Array(20).fill(1)])
  const recordKey = harness.s3.keys().find((key) => key.endsWith('account.json')) as string
  const accountId = recordKey.split('/')[1]
  const { blobPrefix } = JSON.parse(new TextDecoder().decode(harness.s3.objects.get(`backups/${recordKey}`)))
  harness.fault = (url) =>
    url.includes(accountId)
      ? new TypeError(`fetch failed: ${url} for ${ALICE.email} (prefix ${blobPrefix})`)
      : null

  await runBackupMaintenance(harness.env, { reconcile: true })
  const failed = await harness.request('/backup/backups', {}, alice.accessToken)
  expect(failed.status).toBe(500)
  harness.fault = null

  const logged = lines.join('\n')
  expect(logged).toContain(`failed for account ${accountId.slice(0, 12)}: TypeError`)
  expect(logged).toContain('[backup] request failed: TypeError')
  for (const secret of ['s3.test', 'https://', 'accounts/', 'blobs/', ALICE.email, blobPrefix, accountId]) {
    expect(logged).not.toContain(secret)
  }
  // Stack frames name dependency paths with '@' (scoped packages, the Bun
  // store's name@version folders): only an email-shaped value counts.
  expect(logged).not.toMatch(EMAIL)
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

test('a forged X-Forwarded-For off Cloudflare gets no fresh limit', async () => {
  harness.env = backupEnv({
    BACKUP_RATE_LIMITER: createMemoryRateLimiter({ limit: 2, periodSeconds: 60 }),
  })
  // The Node server resolves the address from the socket: an untrusted peer's
  // X-Forwarded-For is its own claim and is ignored (node/resolveClientIp).
  const fromPeer = (forwardedFor: string) => {
    const ip = resolveClientIp({ peer: '203.0.113.9', forwardedFor, isTrustedProxy: () => false })
    const request = new Request('https://backend.test/backup/backups', {
      headers: { 'X-Forwarded-For': forwardedFor, 'CF-Connecting-IP': '198.51.100.1' },
    })
    return harness.app.request(withClientIp(request, ip), undefined, harness.env)
  }
  const statuses = []
  for (const forged of ['10.0.0.1', '10.0.0.2', '10.0.0.3']) {
    statuses.push((await fromPeer(forged)).status)
  }
  expect(statuses).toEqual([401, 401, 429])
})

test('a body over 16 KiB is refused', async () => {
  const response = await harness.request('/backup/session', {
    method: 'POST',
    body: JSON.stringify({ grant: 'x'.repeat(20_000) }),
  })
  expect(response.status).toBe(413)
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
