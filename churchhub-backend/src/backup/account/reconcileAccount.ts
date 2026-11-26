import type { BackupBucket, StoredObject } from '../storage/createBackupBucket'
import type { AccountRecord, BlobEntry } from './AccountRecord'
import {
  accountBackupsPrefix,
  accountBlobsPrefix,
  blobKey,
  manifestKey,
  userPartKey,
} from './accountKeys'
import { abortUploads } from './abortUploads'
import { updateAccount } from './accountStore'
import { expiredBackups } from './expiredBackups'
import { takeExpiredUploads } from './takeExpiredUploads'

export interface ReconcileResult {
  usedBytesBefore: number
  usedBytesAfter: number
  /** Backups unlisted: expired, or a part or blob of theirs was gone. */
  droppedBackups: number
  /** Objects nothing listed, deleted. */
  deletedObjects: number
}

/** The record's blobs and usage recomputed from its backups, uploads and the bucket. */
function recount(record: AccountRecord, sizeOf: Map<string, number>, accountId: string) {
  const blobs: Record<string, BlobEntry> = {}
  const declared = new Map(record.uploads.flatMap((u) => u.newBlobs.map((b) => [b.hash, b.sizeBytes])))
  for (const hash of [...record.backups, ...record.uploads].flatMap((entry) => entry.blobs)) {
    const size = sizeOf.get(blobKey(accountId, record.blobPrefix, hash))
    const entry = (blobs[hash] ??= {
      sizeBytes: size ?? declared.get(hash) ?? 0,
      refs: 0,
      stored: size !== undefined,
    })
    entry.refs += 1
  }
  record.blobs = blobs
  record.usedBytes =
    record.backups.reduce((sum, b) => sum + b.userBytes + b.manifestBytes, 0) +
    Object.values(blobs)
      .filter((blob) => blob.stored)
      .reduce((sum, blob) => sum + blob.sizeBytes, 0)
}

/**
 * Repairs drift between the account's record and the bucket: expired
 * backups and uploads go; backups whose user part, manifest or any blob is
 * gone are unlisted (they couldn't be restored); sizes are read from the
 * objects; blob refs and the usage counter are recomputed from scratch;
 * objects nothing lists are deleted. `objects` may come from one listing
 * of the whole bucket (the daily run); otherwise the account is listed.
 */
export async function reconcileAccount(
  bucket: BackupBucket,
  accountId: string,
  retentionDays: number,
  objects?: StoredObject[]
): Promise<ReconcileResult> {
  const stored = objects ?? [
    ...(await bucket.list(accountBackupsPrefix(accountId))),
    ...(await bucket.list(accountBlobsPrefix(accountId))),
  ]
  const sizeOf = new Map(stored.map((object) => [object.key, object.size]))
  const now = Date.now()
  const outcome = await updateAccount(bucket, accountId, (record) => {
    const usedBytesBefore = record.usedBytes
    const uploads = takeExpiredUploads(record, now)
    const expired = new Set(expiredBackups(record, retentionDays, now))
    const before = record.backups.length
    record.backups = record.backups
      .filter((backup) => !expired.has(backup))
      .filter(
        (backup) =>
          sizeOf.has(userPartKey(accountId, backup.id)) &&
          sizeOf.has(manifestKey(accountId, backup.id)) &&
          backup.blobs.every((hash) => sizeOf.has(blobKey(accountId, record.blobPrefix, hash)))
      )
      .map((backup) => ({
        ...backup,
        userBytes: sizeOf.get(userPartKey(accountId, backup.id)) ?? 0,
        manifestBytes: sizeOf.get(manifestKey(accountId, backup.id)) ?? 0,
      }))
    recount(record, sizeOf, accountId)
    record.lastReconciledAt = now
    const keep = new Set([
      ...[...record.backups, ...record.uploads].flatMap((entry) => [
        userPartKey(accountId, entry.id),
        manifestKey(accountId, entry.id),
      ]),
      ...Object.keys(record.blobs).map((hash) => blobKey(accountId, record.blobPrefix, hash)),
    ])
    return {
      usedBytesBefore,
      expiredUploads: uploads.expired,
      blobPrefix: record.blobPrefix,
      orphans: stored.filter((object) => !keep.has(object.key)),
      usedBytesAfter: record.usedBytes,
      droppedBackups: before - record.backups.length,
    }
  })
  await abortUploads(bucket, accountId, outcome.blobPrefix, outcome.expiredUploads)
  for (const { key } of outcome.orphans) await bucket.delete(key)
  return {
    usedBytesBefore: outcome.usedBytesBefore,
    usedBytesAfter: outcome.usedBytesAfter,
    droppedBackups: outcome.droppedBackups,
    deletedObjects: outcome.orphans.length,
  }
}
