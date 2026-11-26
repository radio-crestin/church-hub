import { afterEach, beforeEach, expect, test } from 'bun:test'
import { accountRecordKey } from '../src/backup/account/accountKeys'
import { runBackupMaintenance } from '../src/backup/runBackupMaintenance'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * The per-account quota (2 GiB by default): an authoritative usage counter
 * changed only by compare-and-swap, reserved at start, checked against the
 * real size at the end, freed by deletes and retention, repaired by the
 * scheduled reconcile. Run with `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness(backupEnv({ BACKUP_QUOTA_BYTES: '1500' }))
  harness.install()
})
afterEach(() => harness.restore())

const bytes = (size: number) => new Uint8Array(size).fill(3)

async function usage(token: string) {
  const response = await harness.request('/backup/usage', {}, token)
  return (await response.json()) as {
    usedBytes: number
    reservedBytes: number
    quotaBytes: number
  }
}

function start(token: string, sizeBytes: number) {
  return harness.json('/backup/uploads', 'POST', { sizeBytes, keyVersion: 1 }, token)
}

/** The account's record as stored, and a way to overwrite it (drift). */
function record() {
  const key = [...harness.s3.objects.keys()].find((k) => k.endsWith('account.json')) as string
  return {
    key,
    value: JSON.parse(new TextDecoder().decode(harness.s3.objects.get(key))),
    write(next: unknown) {
      harness.s3.objects.set(key, new TextEncoder().encode(JSON.stringify(next)))
    },
  }
}

test('unauthenticated callers can’t see usage or start an upload', async () => {
  expect((await harness.request('/backup/usage')).status).toBe(401)
  expect((await start('', 10)).status).toBe(401)
  expect(harness.s3.uploads.size).toBe(0)
})

test('two uploads started at once near the limit: only one gets through', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const answers = await Promise.all([start(accessToken, 800), start(accessToken, 800)])
  expect(answers.map((a) => a.status).sort()).toEqual([201, 413])
  // The loser's multipart upload was aborted; one reservation is left.
  expect(harness.s3.uploads.size).toBe(1)
  expect(await usage(accessToken)).toMatchObject({ usedBytes: 0, reservedBytes: 800 })
})

test('usage counts the real stored size, and a delete frees it', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const first = await harness.upload(accessToken, bytes(600))
  await harness.upload(accessToken, bytes(600))
  expect(await usage(accessToken)).toMatchObject({ usedBytes: 1200, quotaBytes: 1500 })

  const refused = await start(accessToken, 600)
  expect(refused.status).toBe(413)
  expect(await refused.json()).toMatchObject({
    code: 'quota_exceeded',
    usedBytes: 1200,
    neededBytes: 600,
    quotaBytes: 1500,
  })

  await harness.request(`/backup/backups/${first.backupId}`, { method: 'DELETE' }, accessToken)
  expect((await usage(accessToken)).usedBytes).toBe(600)
  expect((await start(accessToken, 600)).status).toBe(201)
})

test('a backup retention would drop makes room when the next one doesn’t fit', async () => {
  harness.env = backupEnv({ BACKUP_QUOTA_BYTES: '1000', BACKUP_MAX_COUNT: '2' })
  const { accessToken } = await harness.signIn(ALICE)
  const oldest = await harness.upload(accessToken, bytes(400))
  await harness.upload(accessToken, bytes(400))
  expect((await start(accessToken, 400)).status).toBe(201)
  expect(await usage(accessToken)).toMatchObject({ usedBytes: 400, reservedBytes: 400 })
  expect(harness.s3.keys().some((key) => key.includes(oldest.backupId))).toBe(false)
})

test('the daily reconcile repairs a drifted counter, lost and stray objects', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const kept = await harness.upload(accessToken, bytes(300))
  const lost = await harness.upload(accessToken, bytes(200))
  const stored = record()
  const folder = stored.key.replace(/account\.json$/, '')
  stored.write({ ...stored.value, usedBytes: 9999 })
  harness.s3.objects.delete(`${folder}backups/${lost.backupId}.chb`)
  harness.s3.objects.set(`${folder}backups/stray.chb`, bytes(50))

  await runBackupMaintenance(harness.env, { reconcile: true })

  expect((await usage(accessToken)).usedBytes).toBe(300)
  const listed = await harness.request('/backup/backups', {}, accessToken)
  const { backups } = (await listed.json()) as { backups: { id: string }[] }
  expect(backups.map((b) => b.id)).toEqual([kept.backupId])
  expect(harness.s3.keys().some((key) => key.endsWith('stray.chb'))).toBe(false)
  expect(record().value.lastReconciledAt).toBeGreaterThan(0)
})

test('the hourly upkeep aborts uploads left unfinished', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await start(accessToken, 100)
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
  expect(accountRecordKey('x')).toBe('accounts/x/account.json')
})
