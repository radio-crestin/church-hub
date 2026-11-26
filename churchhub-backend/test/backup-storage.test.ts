import { afterEach, beforeEach, expect, test } from 'bun:test'
import { PART_SIZE } from '../src/backup/account/startUpload'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * Cloud backup storage: uploads straight to the bucket through short-lived
 * presigned URLs, every id looked up only in the caller's own account,
 * the free tier enforced, and an account deleted with all its data. Run
 * with `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }
const BOB = { sub: 'google-sub-bob', email: 'bob@example.com' }

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness()
  harness.install()
})
afterEach(() => harness.restore())

const bytes = (size: number, fill = 7) => new Uint8Array(size).fill(fill)

async function list(token: string) {
  const response = await harness.request('/backup/backups', {}, token)
  return (await response.json()) as {
    backups: { id: string; sizeBytes: number }[]
    usage: { usedBytes: number; quotaBytes: number }
  }
}

test('a backup goes up in parts and comes back through a presigned URL', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const data = bytes(PART_SIZE + 1000)
  const { backupId, done } = await harness.upload(accessToken, data)
  expect(done.status).toBe(200)

  const { backups, usage } = await list(accessToken)
  expect(backups.map((b) => b.id)).toEqual([backupId])
  expect(usage.usedBytes).toBe(data.length)

  const download = await harness.request(`/backup/backups/${backupId}/download`, { method: 'POST' }, accessToken)
  const { url, expiresAt } = (await download.json()) as { url: string; expiresAt: number }
  const fetched = new Uint8Array(await (await fetch(url)).arrayBuffer())
  expect(fetched).toEqual(data)
  // Presigned for 15 minutes, never longer.
  expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('900')
  expect(new URL(url).searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  expect(Math.abs(expiresAt - (Date.now() + 900_000))).toBeLessThan(5_000)
})

test('part URLs are presigned for 15 minutes', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const started = await harness.json('/backup/uploads', 'POST', { sizeBytes: 10, keyVersion: 1 }, accessToken)
  const { backupId } = (await started.json()) as { backupId: string }
  const presigned = await harness.json(`/backup/uploads/${backupId}/parts`, 'POST', { partNumbers: [1] }, accessToken)
  const { parts, expiresAt } = (await presigned.json()) as {
    parts: { url: string }[]
    expiresAt: number
  }
  const url = new URL(parts[0].url)
  expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
  expect(url.searchParams.get('partNumber')).toBe('1')
  expect(Math.abs(expiresAt - (Date.now() + 900_000))).toBeLessThan(5_000)

  const outOfRange = await harness.json(`/backup/uploads/${backupId}/parts`, 'POST', { partNumbers: [2] }, accessToken)
  expect(outOfRange.status).toBe(400)
})

test('an account never reaches another account’s backups (no IDOR)', async () => {
  const alice = await harness.signIn(ALICE)
  const bob = await harness.signIn(BOB)
  const { backupId } = await harness.upload(alice.accessToken, bytes(100))
  const started = await harness.json('/backup/uploads', 'POST', { sizeBytes: 50, keyVersion: 1 }, alice.accessToken)
  const pending = ((await started.json()) as { backupId: string }).backupId

  expect((await list(bob.accessToken)).backups).toEqual([])
  const attempts: [string, string, unknown][] = [
    ['POST', `/backup/backups/${backupId}/download`, undefined],
    ['DELETE', `/backup/backups/${backupId}`, undefined],
    ['POST', `/backup/uploads/${pending}/parts`, { partNumbers: [1] }],
    ['POST', `/backup/uploads/${pending}/complete`, undefined],
    ['DELETE', `/backup/uploads/${pending}`, undefined],
  ]
  for (const [method, path, body] of attempts) {
    const response = await harness.json(path, method, body ?? {}, bob.accessToken)
    expect(`${method} ${path} ${response.status}`).toBe(`${method} ${path} 404`)
  }
  expect((await list(alice.accessToken)).backups.map((b) => b.id)).toEqual([backupId])

  await harness.upload(bob.accessToken, bytes(10))
  // Each account's objects sit under its own keyed-hash folder: no email, no sub.
  const folders = new Set(harness.s3.keys().map((key) => key.split('/')[1]))
  expect(folders.size).toBe(2)
  for (const folder of folders) expect(folder).toMatch(/^[0-9a-f]{64}$/)
  expect(harness.s3.keys().join()).not.toContain('alice')
  expect(harness.s3.keys().join()).not.toContain(ALICE.sub)
})

test('the free tier: size, storage, uploads in flight and per day', async () => {
  harness.env = backupEnv({
    BACKUP_MAX_BYTES: '1000',
    BACKUP_QUOTA_BYTES: '1500',
    BACKUP_UPLOADS_PER_DAY: '3',
  })
  const { accessToken } = await harness.signIn(ALICE)
  const start = (sizeBytes: number) =>
    harness.json('/backup/uploads', 'POST', { sizeBytes, keyVersion: 1 }, accessToken)
  const code = async (response: Response) =>
    `${response.status} ${((await response.json()) as { code?: string }).code ?? ''}`

  expect(await code(await start(1001))).toBe('413 too_large')
  expect(await code(await start(0))).toBe('400 invalid_request')

  const first = (await (await start(800)).json()) as { backupId: string }
  // 800 reserved + 800 more is over 1500.
  expect(await code(await start(800))).toBe('413 quota_exceeded')
  await start(100)
  expect(await code(await start(100))).toBe('409 upload_in_progress')
  await harness.request(`/backup/uploads/${first.backupId}`, { method: 'DELETE' }, accessToken)
  // Three started today: the fourth waits for tomorrow.
  await start(100)
  expect(await code(await start(100))).toBe('429 daily_limit')
  // Cancelling freed the parts in the bucket.
  expect(harness.s3.uploads.size).toBe(2)
})

test('parts adding up to more than reserved are refused and aborted', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const started = await harness.json('/backup/uploads', 'POST', { sizeBytes: 10, keyVersion: 1 }, accessToken)
  const { backupId } = (await started.json()) as { backupId: string }
  const incomplete = await harness.request(`/backup/uploads/${backupId}/complete`, { method: 'POST' }, accessToken)
  expect(incomplete.status).toBe(409)

  const presigned = await harness.json(`/backup/uploads/${backupId}/parts`, 'POST', { partNumbers: [1] }, accessToken)
  const { parts } = (await presigned.json()) as { parts: { url: string }[] }
  await fetch(parts[0].url, { method: 'PUT', body: bytes(5000) })
  const done = await harness.request(`/backup/uploads/${backupId}/complete`, { method: 'POST' }, accessToken)
  expect(done.status).toBe(400)
  expect(((await done.json()) as { code: string }).code).toBe('size_mismatch')
  expect(harness.s3.uploads.size).toBe(0)
  expect((await list(accessToken)).backups).toEqual([])
})

test('retention keeps at most BACKUP_MAX_COUNT and removes the rest from the bucket', async () => {
  harness.env = backupEnv({ BACKUP_MAX_COUNT: '2' })
  const { accessToken } = await harness.signIn(ALICE)
  const ids: string[] = []
  for (let i = 0; i < 4; i++) {
    ids.push((await harness.upload(accessToken, bytes(10, i))).backupId)
  }
  const kept = (await list(accessToken)).backups.map((b) => b.id)
  expect(kept).toHaveLength(2)
  const objects = harness.s3.keys().filter((key) => key.endsWith('.chb'))
  expect(objects).toHaveLength(2)
  for (const id of kept) expect(objects.some((key) => key.includes(id))).toBe(true)
})

test('deleting one backup, then the whole account', async () => {
  const { accessToken, refreshToken } = await harness.signIn(ALICE)
  const first = await harness.upload(accessToken, bytes(10))
  await harness.upload(accessToken, bytes(20))
  await harness.json('/backup/uploads', 'POST', { sizeBytes: 30, keyVersion: 1 }, accessToken)

  const removed = await harness.request(`/backup/backups/${first.backupId}`, { method: 'DELETE' }, accessToken)
  expect(removed.status).toBe(200)
  expect((await list(accessToken)).backups).toHaveLength(1)

  const deleted = await harness.request('/backup/account', { method: 'DELETE' }, accessToken)
  expect(await deleted.json()).toEqual({ deletedBackups: 1 })
  // Only the empty record is left: no backups, no uploads in flight.
  expect(harness.s3.keys().filter((key) => !key.endsWith('account.json'))).toEqual([])
  expect(harness.s3.uploads.size).toBe(0)
  const record = JSON.parse(
    new TextDecoder().decode([...harness.s3.objects.values()][0])
  )
  expect(record.backups).toEqual([])
  expect(JSON.stringify(record)).not.toContain('alice')
  // Every token issued before is refused.
  expect((await harness.request('/backup/backups', {}, accessToken)).status).toBe(401)
  const refresh = await harness.json('/backup/session/refresh', 'POST', { refreshToken })
  expect(refresh.status).toBe(401)
})
