import { afterEach, beforeEach, expect, test } from 'bun:test'
import { runBackupMaintenance } from '../src/backup/runBackupMaintenance'
import { BackupHarness } from './support/backupHarness'

/**
 * What cloud backup leaves behind, and what it never trips on: whole-file
 * URLs only for blobs still unstored; files sent after an abort swept once
 * no URL can write them; an account deletion erases everything, an older
 * layout included; version-1 records migrated; one bad account never stops
 * upkeep for the others. Run with `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }
const BOB = { sub: 'google-sub-bob', email: 'bob@example.com' }
const DAY_MS = 24 * 60 * 60 * 1000
const OLD = () => Date.now() - 16 * 60 * 1000

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness()
  harness.install()
})
afterEach(() => harness.restore())

const bytes = (size: number, fill = 3) => new Uint8Array(size).fill(fill)
const recordKeyOf = (email: string) =>
  [...harness.s3.objects.keys()].find(
    (key) =>
      key.endsWith('account.json') &&
      new TextDecoder().decode(harness.s3.objects.get(key)).includes(email)
  ) as string
const accountIdOf = (email: string) => recordKeyOf(email).split('/')[2]

async function filesFor(token: string, backupId: string, files: string[]) {
  return harness.json(`/backup/uploads/${backupId}/files`, 'POST', { files }, token)
}

test('whole-file URLs only for blobs the account hasn’t stored', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const bible = bytes(300, 1)
  await harness.upload(accessToken, bytes(10), [bible])
  const started = await harness.start(accessToken, 10, [bible])
  const { backupId, missingBlobs } = (await started.json()) as { backupId: string; missingBlobs: string[] }
  expect(missingBlobs).toEqual([])
  expect((await filesFor(accessToken, backupId, [BackupHarness.hashOf(bible)])).status).toBe(400)
  expect((await filesFor(accessToken, backupId, ['manifest'])).status).toBe(200)
  // Not once the upload is gone either.
  await harness.request(`/backup/uploads/${backupId}`, { method: 'DELETE' }, accessToken)
  expect((await filesFor(accessToken, backupId, ['manifest'])).status).toBe(404)
})

test('files sent after an abort are swept once no URL can write them', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const blob = bytes(200, 2)
  const started = await harness.start(accessToken, 10, [blob])
  const { backupId } = (await started.json()) as { backupId: string }
  const filed = await filesFor(accessToken, backupId, ['manifest', BackupHarness.hashOf(blob)])
  const { files } = (await filed.json()) as { files: { url: string; sizeBytes: number; headers: Record<string, string> }[] }
  await harness.request(`/backup/uploads/${backupId}`, { method: 'DELETE' }, accessToken)
  // The URLs are still valid for a few minutes: the files land anyway.
  for (const file of files) {
    await fetch(file.url, { method: 'PUT', body: bytes(file.sizeBytes), headers: file.headers })
  }
  const stray = () => harness.s3.keys().filter((key) => key.startsWith('backups/') || key.startsWith('blobs/'))
  expect(stray()).toHaveLength(2)

  await runBackupMaintenance(harness.env, { reconcile: false })
  expect(stray()).toHaveLength(2)

  for (const key of harness.s3.modified.keys()) harness.s3.modified.set(key, OLD())
  await runBackupMaintenance(harness.env, { reconcile: false })
  expect(stray()).toEqual([])
})

test('deleting an account erases everything under its prefixes, an older layout included, but the tombstone', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await harness.upload(accessToken, bytes(10), [bytes(100, 1)])
  await harness.start(accessToken, 10)
  const accountId = accountIdOf(ALICE.email)
  harness.s3.objects.set(`backups/accounts/${accountId}/backups/legacy.chb`, bytes(30))
  harness.s3.objects.set(`backups/accounts/${accountId}/notes.json`, bytes(5))

  await harness.request('/backup/account', { method: 'DELETE' }, accessToken)

  // Only the tombstone (limits, nothing personal) carries the account id.
  expect(harness.s3.keys().filter((key) => key.includes(accountId))).toEqual([
    `tombstones/${accountId}.json`,
  ])
  expect(harness.s3.uploads.size).toBe(0)
  // A later sign-in starts a new, empty account.
  const again = await harness.signIn(ALICE)
  const listed = await harness.request('/backup/backups', {}, again.accessToken)
  expect(((await listed.json()) as { backups: unknown[] }).backups).toEqual([])
})

test('a version-1 record is migrated: listed, deleted, expired, reconciled', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const key = recordKeyOf(ALICE.email)
  const stored = JSON.parse(new TextDecoder().decode(harness.s3.objects.get(key)))
  const v1 = {
    ...stored,
    version: 1,
    blobs: undefined,
    usedBytes: 300,
    backups: [
      { id: 'A'.repeat(22), sizeBytes: 100, createdAt: Date.now() - 31 * DAY_MS, appVersion: '0.1', keyVersion: 1 },
      { id: 'B'.repeat(22), sizeBytes: 200, createdAt: Date.now(), appVersion: '0.1', keyVersion: 1 },
    ],
    uploads: [],
  }
  harness.s3.objects.set(key, new TextEncoder().encode(JSON.stringify(v1)))

  const listed = await harness.request('/backup/backups', {}, accessToken)
  expect(listed.status).toBe(200)
  expect(((await listed.json()) as { backups: { sizeBytes: number }[] }).backups.map((b) => b.sizeBytes)).toEqual([200, 100])
  await runBackupMaintenance(harness.env, { reconcile: false })
  const after = await harness.request('/backup/backups', {}, accessToken)
  expect(((await after.json()) as { backups: { id: string }[] }).backups.map((b) => b.id)).toEqual(['B'.repeat(22)])
  expect((await harness.request(`/backup/backups/${'B'.repeat(22)}`, { method: 'DELETE' }, accessToken)).status).toBe(200)
  await runBackupMaintenance(harness.env, { reconcile: true })
})

test('one bad account never stops upkeep for the others', async () => {
  const alice = await harness.signIn(ALICE)
  const bob = await harness.signIn(BOB)
  await harness.upload(alice.accessToken, bytes(10))
  const bobs = await harness.upload(bob.accessToken, bytes(10))
  harness.s3.objects.set(recordKeyOf(ALICE.email), new TextEncoder().encode('{not json'))
  const bobKey = recordKeyOf(BOB.email)
  const record = JSON.parse(new TextDecoder().decode(harness.s3.objects.get(bobKey)))
  record.backups[0].createdAt = Date.now() - 31 * DAY_MS
  harness.s3.objects.set(bobKey, new TextEncoder().encode(JSON.stringify(record)))

  const lines: string[] = []
  const realError = console.error
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(' '))
  try {
    await runBackupMaintenance(harness.env, { reconcile: true })
  } finally {
    console.error = realError
  }

  expect(harness.s3.keys().some((key) => key.includes(bobs.backupId))).toBe(false)
  const failures = lines.join('\n')
  expect(failures).toContain('failed for account')
  expect(failures).not.toContain(ALICE.email)
})
