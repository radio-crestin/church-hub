import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'

const DAY_MS = 24 * 60 * 60 * 1000
/** A tombstone is purged this long after the account was deleted. */
export const TOMBSTONE_DAYS = 90
export const TOMBSTONES_PREFIX = 'tombstones/'

/**
 * What stays of a deleted account, so deleting it doesn't lift the limits
 * it was given: the pause, an admin's quota and the day's uploads. Keyed by
 * the account hash; no email, no Google id, no backup data.
 */
export interface Tombstone {
  deletedAt: number
  suspended: boolean
  quotaBytes: number | null
  uploadCount: number
  /** UTC day (YYYY-MM-DD) the upload count is for. */
  uploadDate: string
}

export const tombstoneKey = (accountId: string) =>
  `${TOMBSTONES_PREFIX}${accountId}.json`

const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10)

export function tombstoneOf(record: AccountRecord, now: number): Tombstone {
  return {
    deletedAt: now,
    suspended: record.suspended,
    quotaBytes: record.quotaBytes,
    uploadCount: record.uploadLog.filter((at) => now - at < DAY_MS).length,
    uploadDate: utcDay(now),
  }
}

export async function readTombstone(
  bucket: BackupBucket,
  accountId: string
): Promise<Tombstone | null> {
  const found = await bucket.get(tombstoneKey(accountId))
  return found ? (JSON.parse(found.text) as Tombstone) : null
}

/**
 * A new record takes the limits back (in place): still paused if it was,
 * the admin's quota, and the day's uploads when it is still that day.
 */
export function applyTombstone(record: AccountRecord, tombstone: Tombstone, now: number) {
  record.suspended = tombstone.suspended
  record.quotaBytes = tombstone.quotaBytes
  if (tombstone.uploadDate === utcDay(now)) {
    record.uploadLog = [
      ...record.uploadLog,
      ...Array.from({ length: tombstone.uploadCount }, () => tombstone.deletedAt),
    ]
  }
}

/** Deletes tombstones older than TOMBSTONE_DAYS (by when they were written). */
export async function purgeOldTombstones(bucket: BackupBucket, now = Date.now()) {
  const old = (await bucket.list(TOMBSTONES_PREFIX)).filter(
    (object) => now - object.lastModified >= TOMBSTONE_DAYS * DAY_MS
  )
  for (const { key } of old) await bucket.delete(key)
  return old.length
}
