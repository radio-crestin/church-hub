import { afterEach, beforeEach, expect, test } from 'bun:test'
import { runBackupMaintenance } from '../src/backup/runBackupMaintenance'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * What a deleted account keeps: a tombstone with only its limits (pause,
 * an admin's quota, the last 24 hours' uploads), taken back when the same
 * Google account signs in again, purged 90 days after deletion. A sign-in
 * during a deletion is refused, so no fresh record slips in without them.
 * Run with `bun test` from churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice-1234567890', email: 'alice@example.com' }
const DAY_MS = 24 * 60 * 60 * 1000

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness(backupEnv({ BACKUP_UPLOADS_PER_DAY: '2' }))
  harness.install()
})
afterEach(() => harness.restore())

const recordKey = () =>
  [...harness.s3.objects.keys()].find((k) => k.endsWith('account.json')) as string | undefined

/** Changes the account's stored record, as an admin's action would. */
function editRecord(change: (record: Record<string, unknown>) => void) {
  const key = recordKey() as string
  const record = JSON.parse(new TextDecoder().decode(harness.s3.objects.get(key)))
  change(record)
  harness.s3.objects.set(key, new TextEncoder().encode(JSON.stringify(record)))
}

const readRecord = () =>
  JSON.parse(new TextDecoder().decode(harness.s3.objects.get(recordKey() as string)))

const tombstones = () =>
  [...harness.s3.objects].filter(([key]) => key.startsWith('backups/tombstones/'))

async function usage(token: string) {
  const response = await harness.request('/backup/usage', {}, token)
  return (await response.json()) as { quotaBytes: number; suspended: boolean }
}

/** Runs `work` with Date.now() at `at`. */
async function at<T>(time: number, work: () => Promise<T>): Promise<T> {
  const realNow = Date.now
  Date.now = () => time
  try {
    return await work()
  } finally {
    Date.now = realNow
  }
}

test('the tombstone holds only the limits, nothing personal', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await harness.upload(accessToken, new Uint8Array(10), [new Uint8Array(20).fill(1)])
  await harness.request('/backup/account', { method: 'DELETE' }, accessToken)

  const [[key, body]] = tombstones()
  expect(key).toMatch(/^backups\/tombstones\/[0-9a-f]{64}\.json$/)
  const text = new TextDecoder().decode(body)
  const tombstone = JSON.parse(text)
  expect(Object.keys(tombstone).sort()).toEqual(['deletedAt', 'quotaBytes', 'suspended', 'uploadLog'])
  expect(tombstone.uploadLog).toHaveLength(1)
  expect(tombstone.uploadLog.every((at: unknown) => typeof at === 'number')).toBe(true)
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
})

test('a sign-in during a deletion is refused and doesn’t recreate the record', async () => {
  const first = await harness.signIn(ALICE)
  editRecord((record) => {
    record.suspended = true
    record.deletingSince = Date.now()
  })
  const during = await harness.signIn(ALICE)
  expect(during.sessionStatus).toBe(409)
  expect(readRecord()).toMatchObject({ suspended: true, sessions: expect.any(Object) })
  expect(Object.keys(readRecord().sessions)).toHaveLength(1)

  // A deletion left unfinished is finished by the upkeep, tombstone first.
  editRecord((record) => {
    record.deletingSince = Date.now() - 16 * 60 * 1000
  })
  await runBackupMaintenance(harness.env, { reconcile: false })
  expect(recordKey()).toBeUndefined()
  expect(tombstones()).toHaveLength(1)
  const again = await harness.signIn(ALICE)
  expect((await usage(again.accessToken)).suspended).toBe(true)
  expect(first.accessToken).not.toBe(again.accessToken)
})

test('deleting near midnight keeps the rolling 24-hour upload count', async () => {
  const midnight = Date.UTC(2027, 0, 15)
  const { accessToken } = await at(midnight - 60_000, () => harness.signIn(ALICE))
  editRecord((record) => {
    record.uploadLog = [midnight - 50_000, midnight - 40_000]
  })
  await at(midnight - 30_000, () =>
    harness.request('/backup/account', { method: 'DELETE' }, accessToken)
  )
  // Two minutes later, a new day: the two uploads are still within 24 hours.
  const refused = await at(midnight + 90_000, async () => {
    const again = await harness.signIn(ALICE)
    return harness.start(again.accessToken, 10)
  })
  expect(((await refused.json()) as { code: string }).code).toBe('daily_limit')
})

test('two sign-ins at once after a deletion both keep the pause', async () => {
  const first = await harness.signIn(ALICE)
  editRecord((record) => {
    record.suspended = true
  })
  await harness.request('/backup/account', { method: 'DELETE' }, first.accessToken)
  const [one, two] = await Promise.all([harness.signIn(ALICE), harness.signIn(ALICE)])
  expect(one.sessionStatus).toBe(200)
  expect(two.sessionStatus).toBe(200)
  for (const session of [one, two]) {
    expect((await usage(session.accessToken)).suspended).toBe(true)
  }
  expect(readRecord().suspended).toBe(true)
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
