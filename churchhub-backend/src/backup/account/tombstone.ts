import { SyncError } from '../../sync/SyncError'
import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'

const DAY_MS = 24 * 60 * 60 * 1000
/** A tombstone is purged this long after the account was deleted. */
export const TOMBSTONE_DAYS = 90
export const TOMBSTONES_PREFIX = 'tombstones/'
const MAX_ATTEMPTS = 5

/**
 * What stays of a deleted account, so deleting it doesn't lift the limits
 * it was given: the pause, an admin's quota and its uploads of the last 24
 * hours (the daily limit's rolling window). Keyed by the account hash; no
 * email, no Google id, no backup data. Kept until purged.
 */
export interface Tombstone {
  deletedAt: number
  suspended: boolean
  quotaBytes: number | null
  /** When uploads started in the 24 hours before the deletion (unix ms). */
  uploadLog: number[]
}

export const tombstoneKey = (accountId: string) =>
  `${TOMBSTONES_PREFIX}${accountId}.json`

export function tombstoneOf(record: AccountRecord, now: number): Tombstone {
  return {
    deletedAt: now,
    suspended: record.suspended,
    quotaBytes: record.quotaBytes,
    uploadLog: record.uploadLog.filter((at) => now - at < DAY_MS),
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
 * Writes the account's tombstone with a compare-and-swap: a new one, or in
 * place of the one an earlier deletion left (on its ETag).
 */
export async function writeTombstone(
  bucket: BackupBucket,
  accountId: string,
  tombstone: Tombstone
): Promise<void> {
  const key = tombstoneKey(accountId)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const found = await bucket.get(key)
    const written = await bucket.put(
      key,
      JSON.stringify(tombstone),
      found ? { ifMatch: found.etag } : { ifNoneMatch: '*' }
    )
    if (written !== null) return
  }
  throw new SyncError(503, 'busy', 'Try again in a moment')
}

/**
 * A new record takes the limits back (in place): still paused if it was,
 * the admin's quota, and every upload still within the last 24 hours, as
 * checkCanStartUpload counts them.
 */
export function applyTombstone(record: AccountRecord, tombstone: Tombstone, now: number) {
  record.suspended = tombstone.suspended
  record.quotaBytes = tombstone.quotaBytes
  record.uploadLog = [
    ...record.uploadLog,
    ...tombstone.uploadLog.filter((at) => now - at < DAY_MS),
  ]
}

/** Deletes tombstones older than TOMBSTONE_DAYS (by when they were written). */
export async function purgeOldTombstones(bucket: BackupBucket, now = Date.now()) {
  const old = (await bucket.list(TOMBSTONES_PREFIX)).filter(
    (object) => now - object.lastModified >= TOMBSTONE_DAYS * DAY_MS
  )
  for (const { key } of old) await bucket.delete(key)
  return old.length
}
