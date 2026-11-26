import { afterEach, beforeEach, expect, test } from 'bun:test'
import { runBackupMaintenance } from '../src/backup/runBackupMaintenance'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * What a deleted account keeps: a tombstone with only its limits (pause,
 * an admin's quota, the day's uploads), taken back when the same Google
 * account signs in again, purged 90 days after deletion. Run with
 * `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice-1234567890', email: 'alice@example.com' }
const DAY_MS = 24 * 60 * 60 * 1000

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness(backupEnv({ BACKUP_UPLOADS_PER_DAY: '2' }))
  harness.install()
})
afterEach(() => harness.restore())

/** Changes the account's stored record, as an admin's action would. */
function editRecord(change: (record: Record<string, unknown>) => void) {
  const key = [...harness.s3.objects.keys()].find((k) => k.endsWith('account.json')) as string
  const record = JSON.parse(new TextDecoder().decode(harness.s3.objects.get(key)))
  change(record)
  harness.s3.objects.set(key, new TextEncoder().encode(JSON.stringify(record)))
}

const tombstones = () =>
  [...harness.s3.objects].filter(([key]) => key.startsWith('backups/tombstones/'))

async function usage(token: string) {
  const response = await harness.request('/backup/usage', {}, token)
  return (await response.json()) as { quotaBytes: number; suspended: boolean }
}

test('the tombstone holds only the limits, nothing personal', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await harness.upload(accessToken, new Uint8Array(10), [new Uint8Array(20).fill(1)])
  await harness.request('/backup/account', { method: 'DELETE' }, accessToken)

  const [[key, body]] = tombstones()
  expect(key).toMatch(/^backups\/tombstones\/[0-9a-f]{64}\.json$/)
  const text = new TextDecoder().decode(body)
  const tombstone = JSON.parse(text)
  expect(Object.keys(tombstone).sort()).toEqual(
    ['deletedAt', 'quotaBytes', 'suspended', 'uploadCount', 'uploadDate'].sort()
  )
  expect(tombstone).toMatchObject({ suspended: false, quotaBytes: null, uploadCount: 1 })
  for (const personal of [ALICE.email, ALICE.sub, '@', 'blob', 'backup']) {
    expect(text).not.toContain(personal)
  }
})

test('signing in again after deleting keeps the pause and the quota override', async () => {
  const first = await harness.signIn(ALICE)
  editRecord((record) => {
    record.suspended = true
    record.quotaBytes = 5000
  })
  await harness.request('/backup/account', { method: 'DELETE' }, first.accessToken)

  const again = await harness.signIn(ALICE)
  expect(await usage(again.accessToken)).toMatchObject({ suspended: true, quotaBytes: 5000 })
  const refused = await harness.start(again.accessToken, 10)
  expect(((await refused.json()) as { code: string }).code).toBe('suspended')
  // Taken back into the account: the tombstone is gone.
  expect(tombstones()).toEqual([])
})

test('deleting doesn’t reset the day’s uploads', async () => {
  const first = await harness.signIn(ALICE)
  await harness.upload(first.accessToken, new Uint8Array(10))
  await harness.upload(first.accessToken, new Uint8Array(10))
  await harness.request('/backup/account', { method: 'DELETE' }, first.accessToken)
  const again = await harness.signIn(ALICE)
  const refused = await harness.start(again.accessToken, 10)
  expect(((await refused.json()) as { code: string }).code).toBe('daily_limit')
})

test('tombstones are purged 90 days after the deletion', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  editRecord((record) => {
    record.suspended = true
  })
  await harness.request('/backup/account', { method: 'DELETE' }, accessToken)
  const [[key]] = tombstones()

  harness.s3.modified.set(key, Date.now() - 89 * DAY_MS)
  await runBackupMaintenance(harness.env, { reconcile: false })
  expect(tombstones()).toHaveLength(1)

  harness.s3.modified.set(key, Date.now() - 90 * DAY_MS - 1000)
  await runBackupMaintenance(harness.env, { reconcile: false })
  expect(tombstones()).toEqual([])
  // Past the purge, a new sign-in starts with no limits.
  const again = await harness.signIn(ALICE)
  expect((await usage(again.accessToken)).suspended).toBe(false)
})
