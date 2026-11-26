import { SyncError } from '../../sync/SyncError'
import type { BackupEntry, PendingUpload } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { backupObjectKey } from './accountKeys'
import { readAccount, updateAccount } from './accountStore'
import { applyRetention } from './applyRetention'
import type { BackupContext } from './BackupContext'
import { effectiveQuota } from './effectiveQuota'
import { findPendingUpload, requireBackupId } from './findPendingUpload'
import { sweepUnlistedObjects } from './sweepUnlistedObjects'

/** Drops the pending upload from the record and the parts from the bucket. */
async function abandon(context: BackupContext, upload: PendingUpload) {
  const { bucket, caller } = context
  await updateAccount(bucket, caller.accountId, (record) => {
    record.uploads = record.uploads.filter((entry) => entry.id !== upload.id)
  })
  await abortUploads(bucket, caller.accountId, [upload])
}

/**
 * Finishes the caller's upload. Its parts must add up to exactly the size
 * it reserved (more is aborted). After the bucket assembles them, the real
 * size is read back (HEAD), never taken from the client: another size, or a
 * total past the account's quota, deletes the object and is refused.
 * Otherwise the backup is listed, the usage counter grows by its real size
 * and shrinks by what retention drops, in one compare-and-swap.
 */
export async function completeUpload(
  context: BackupContext,
  backupId: string | undefined
): Promise<BackupEntry> {
  const { bucket, settings, caller } = context
  const id = requireBackupId(backupId)
  const { record: current } = await readAccount(bucket, caller.accountId)
  const upload = findPendingUpload(current, id)
  const key = backupObjectKey(caller.accountId, id)

  const parts = (await bucket.listParts(key, upload.uploadId)).sort(
    (a, b) => a.partNumber - b.partNumber
  )
  const total = parts.reduce((sum, part) => sum + part.size, 0)
  if (total > upload.sizeBytes || parts.some((p) => p.partNumber > upload.partCount)) {
    await abandon(context, upload)
    throw new SyncError(400, 'size_mismatch', 'The upload is larger than reserved')
  }
  if (total !== upload.sizeBytes || parts.length !== upload.partCount) {
    throw new SyncError(409, 'upload_incomplete', 'Some parts are missing', {
      uploadedParts: parts.map((part) => part.partNumber),
    })
  }
  await bucket.completeMultipartUpload(key, upload.uploadId, parts)
  const actualSize = await bucket.size(key)

  const now = Date.now()
  const outcome = await updateAccount(bucket, caller.accountId, (record) => {
    findPendingUpload(record, id)
    record.uploads = record.uploads.filter((entry) => entry.id !== id)
    if (actualSize !== upload.sizeBytes) return { refused: 'size' as const, record }
    const backup: BackupEntry = {
      id,
      sizeBytes: actualSize,
      createdAt: now,
      appVersion: upload.appVersion,
      keyVersion: upload.keyVersion,
    }
    const { kept, removed } = applyRetention(
      [...record.backups, backup],
      settings.limits.maxBackups,
      now
    )
    const freed = removed.reduce((sum, entry) => sum + entry.sizeBytes, 0)
    const usedBytes = record.usedBytes + actualSize - freed
    if (usedBytes > effectiveQuota(record, settings.limits)) {
      return { refused: 'quota' as const, record }
    }
    record.backups = kept
    record.usedBytes = usedBytes
    record.lastBackupAt = now
    return { backup, record }
  })
  if ('refused' in outcome) {
    await bucket.delete(key)
    throw outcome.refused === 'size'
      ? new SyncError(400, 'size_mismatch', 'The upload is not the size reserved')
      : new SyncError(413, 'quota_exceeded', 'The account’s storage is full')
  }
  await sweepUnlistedObjects(bucket, caller.accountId, outcome.record)
  return outcome.backup
}
