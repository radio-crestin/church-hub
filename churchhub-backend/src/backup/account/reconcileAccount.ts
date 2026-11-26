import type { BackupBucket, StoredObject } from '../storage/createBackupBucket'
import { abortUploads } from './abortUploads'
import { accountPrefix, backupObjectKey } from './accountKeys'
import { updateAccount } from './accountStore'
import { takeExpiredUploads } from './takeExpiredUploads'

export interface ReconcileResult {
  usedBytesBefore: number
  usedBytesAfter: number
  /** Listed backups whose object was gone. */
  missingBackups: number
  /** Objects no backup or upload listed, deleted. */
  deletedObjects: number
}

/**
 * Repairs drift between the account's record and its bucket folder: the
 * usage counter is recomputed from the objects' real sizes, backups whose
 * object is gone are unlisted, expired uploads are aborted and objects
 * nothing lists are deleted. `objects` may come from one listing of the
 * whole bucket (the scheduled run); otherwise the folder is listed.
 */
export async function reconcileAccount(
  bucket: BackupBucket,
  accountId: string,
  objects?: StoredObject[]
): Promise<ReconcileResult> {
  const stored =
    objects ?? (await bucket.list(`${accountPrefix(accountId)}backups/`))
  const sizeOf = new Map(stored.map((object) => [object.key, object.size]))
  const now = Date.now()
  const outcome = await updateAccount(bucket, accountId, (record) => {
    const expired = takeExpiredUploads(record, now)
    const usedBytesBefore = record.usedBytes
    const before = record.backups.length
    record.backups = record.backups
      .filter((backup) => sizeOf.has(backupObjectKey(accountId, backup.id)))
      .map((backup) => ({
        ...backup,
        sizeBytes: sizeOf.get(backupObjectKey(accountId, backup.id)) ?? 0,
      }))
    record.usedBytes = record.backups.reduce((sum, b) => sum + b.sizeBytes, 0)
    record.lastReconciledAt = now
    const listed = new Set(
      [...record.backups, ...record.uploads].map((entry) =>
        backupObjectKey(accountId, entry.id)
      )
    )
    return {
      expired,
      orphans: stored.filter((object) => !listed.has(object.key)),
      usedBytesBefore,
      usedBytesAfter: record.usedBytes,
      missingBackups: before - record.backups.length,
    }
  })
  await abortUploads(bucket, accountId, outcome.expired)
  for (const { key } of outcome.orphans) await bucket.delete(key)
  return {
    usedBytesBefore: outcome.usedBytesBefore,
    usedBytesAfter: outcome.usedBytesAfter,
    missingBackups: outcome.missingBackups,
    deletedObjects: outcome.orphans.length,
  }
}
