import { afterEach, beforeEach, expect, test } from 'bun:test'
import { runBackupMaintenance } from '../src/backup/runBackupMaintenance'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * The per-account quota (2 GiB by default) and the 30-day history: an
 * authoritative usage counter and blob reference counts, changed only by
 * compare-and-swap; a hard refusal at the limit (nothing pruned to make
 * room); backups expiring after 30 days; a daily reconcile as repair. Run
 * with `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }
const DAY_MS = 24 * 60 * 60 * 1000

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness(backupEnv({ BACKUP_QUOTA_BYTES: '1500' }))
  harness.install()
})
afterEach(() => harness.restore())

const bytes = (size: number, fill = 3) => new Uint8Array(size).fill(fill)

async function usage(token: string) {
  const response = await harness.request('/backup/usage', {}, token)
  return (await response.json()) as {
    usedBytes: number
    reservedBytes: number
    quotaBytes: number
  }
}

async function listed(token: string) {
  const response = await harness.request('/backup/backups', {}, token)
  return ((await response.json()) as { backups: { id: string }[] }).backups.map((b) => b.id)
}

/** The account's record as stored, and a way to overwrite it. */
function record() {
  const key = [...harness.s3.objects.keys()].find((k) => k.endsWith('account.json')) as string
  return {
    value: JSON.parse(new TextDecoder().decode(harness.s3.objects.get(key))),
    accountId: key.split('/')[2],
    write(next: unknown) {
      harness.s3.objects.set(key, new TextEncoder().encode(JSON.stringify(next)))
    },
  }
}

test('unauthenticated callers can’t see usage or start an upload', async () => {
  expect((await harness.request('/backup/usage')).status).toBe(401)
  expect((await harness.start('', 10)).status).toBe(401)
  expect(harness.s3.uploads.size).toBe(0)
})

test('at the limit a backup is refused, and nothing is deleted to make room', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const first = await harness.upload(accessToken, bytes(600))
  const second = await harness.upload(accessToken, bytes(600))
  expect(await usage(accessToken)).toMatchObject({ usedBytes: 1300, quotaBytes: 1500 })

  const refused = await harness.start(accessToken, 600)
  expect(refused.status).toBe(413)
  expect(await refused.json()).toMatchObject({
    code: 'quota_exceeded',
    usedBytes: 1300,
    neededBytes: 650,
    quotaBytes: 1500,
  })
  expect(await listed(accessToken)).toEqual([second.backupId, first.backupId])
})

test('two uploads started at once near the limit: only one gets through', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const answers = await Promise.all([harness.start(accessToken, 800), harness.start(accessToken, 800)])
  expect(answers.map((a) => a.status).sort()).toEqual([201, 413])
  expect(harness.s3.uploads.size).toBe(1)
  expect(await usage(accessToken)).toMatchObject({ usedBytes: 0, reservedBytes: 850 })
})

test('a blob is counted once and deleted with the last backup that needs it', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const bible = bytes(400, 1)
  const first = await harness.upload(accessToken, bytes(100), [bible])
  const second = await harness.upload(accessToken, bytes(100), [bible])
  expect((await usage(accessToken)).usedBytes).toBe(150 + 150 + 400)
  expect(record().value.blobs[BackupHarness.hashOf(bible)]).toMatchObject({ refs: 2, stored: true })

  await harness.request(`/backup/backups/${first.backupId}`, { method: 'DELETE' }, accessToken)
  expect((await usage(accessToken)).usedBytes).toBe(150 + 400)
  expect(record().value.blobs[BackupHarness.hashOf(bible)].refs).toBe(1)
  expect(harness.s3.keys().filter((k) => k.startsWith('blobs/'))).toHaveLength(1)

  await harness.request(`/backup/backups/${second.backupId}`, { method: 'DELETE' }, accessToken)
  expect((await usage(accessToken)).usedBytes).toBe(0)
  expect(record().value.blobs).toEqual({})
  expect(harness.s3.keys().filter((k) => k.startsWith('blobs/'))).toEqual([])
  // Freed: a backup that didn't fit before fits now.
  expect((await harness.start(accessToken, 1400)).status).toBe(201)
})

test('backups expire 30 days after they were made', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const bible = bytes(300, 1)
  const old = await harness.upload(accessToken, bytes(100), [bible])
  const recent = await harness.upload(accessToken, bytes(100), [bible, bytes(50, 5)])
  const stored = record()
  stored.value.backups.find((b: { id: string }) => b.id === old.backupId).createdAt = Date.now() - 30 * DAY_MS - 1000
  stored.value.backups.find((b: { id: string }) => b.id === recent.backupId).createdAt = Date.now() - 29 * DAY_MS
  stored.write(stored.value)

  await runBackupMaintenance(harness.env, { reconcile: false })

  expect(await listed(accessToken)).toEqual([recent.backupId])
  expect(harness.s3.keys().some((key) => key.includes(old.backupId))).toBe(false)
  // The shared blob stays: the recent backup still needs it.
  expect(record().value.blobs[BackupHarness.hashOf(bible)].refs).toBe(1)
  expect((await usage(accessToken)).usedBytes).toBe(150 + 300 + 50)
})

test('the daily reconcile repairs a drifted counter, lost and stray objects', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const bible = bytes(300, 1)
  const kept = await harness.upload(accessToken, bytes(100), [bible])
  const lost = await harness.upload(accessToken, bytes(100), [bytes(77, 6)])
  const stored = record()
  stored.write({ ...stored.value, usedBytes: 9999, blobs: {} })
  harness.s3.objects.delete(`backups/backups/${stored.accountId}/${lost.backupId}/user.chb`)
  harness.s3.objects.set(`backups/blobs/${stored.accountId}/${stored.value.blobPrefix}/${'e'.repeat(64)}`, bytes(40))

  // Stray objects are swept once older than any presigned URL (15 minutes).
  for (const key of harness.s3.modified.keys()) harness.s3.modified.set(key, Date.now() - 16 * 60 * 1000)

  await runBackupMaintenance(harness.env, { reconcile: true })

  expect(await listed(accessToken)).toEqual([kept.backupId])
  expect((await usage(accessToken)).usedBytes).toBe(150 + 300)
  expect(record().value.blobs).toEqual({
    [BackupHarness.hashOf(bible)]: { sizeBytes: 300, refs: 1, stored: true },
  })
  expect(harness.s3.keys().filter((k) => k.startsWith('blobs/'))).toHaveLength(1)
  expect(record().value.lastReconciledAt).toBeGreaterThan(0)
})

test('the hourly upkeep aborts uploads left unfinished', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await harness.start(accessToken, 100)
  for (const upload of harness.s3.uploads.values()) {
    upload.initiatedAt = Date.now() - 7 * 60 * 60 * 1000
  }
  await runBackupMaintenance(harness.env, { reconcile: false })
  expect(harness.s3.uploads.size).toBe(0)
})

test('the quota is one setting, 2 GiB by default', async () => {
  harness.env = backupEnv()
  const { accessToken } = await harness.signIn(ALICE)
  expect((await usage(accessToken)).quotaBytes).toBe(2 * 1024 * 1024 * 1024)
})
