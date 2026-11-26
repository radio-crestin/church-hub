import { SyncError } from '../../sync/SyncError'
import type { BackupEntry, PendingUpload } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { backupObjectKey } from './accountKeys'
import { readAccount, updateAccount } from './accountStore'
import { applyRetention } from './applyRetention'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'
import { sweepUnlistedObjects } from './sweepUnlistedObjects'

/** Drops the pending upload from the record (after an abort or a mismatch). */
async function forgetUpload(context: BackupContext, upload: PendingUpload) {
  const { bucket, caller } = context
  await updateAccount(bucket, caller.accountId, (record) => {
    record.uploads = record.uploads.filter((entry) => entry.id !== upload.id)
  })
  await abortUploads(bucket, caller.accountId, [upload])
}

/**
 * Finishes the caller's upload: its parts must add up to exactly the size
 * it reserved (else it is aborted), then the bucket assembles them, the
 * backup is listed and retention drops what it replaces.
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
    await forgetUpload(context, upload)
    throw new SyncError(400, 'size_mismatch', 'The upload is larger than reserved')
  }
  if (total !== upload.sizeBytes || parts.length !== upload.partCount) {
    throw new SyncError(409, 'upload_incomplete', 'Some parts are missing', {
      uploadedParts: parts.map((part) => part.partNumber),
    })
  }
  await bucket.completeMultipartUpload(key, upload.uploadId, parts)
  if ((await bucket.size(key)) !== upload.sizeBytes) {
    await updateAccount(bucket, caller.accountId, (record) => {
      record.uploads = record.uploads.filter((entry) => entry.id !== id)
    })
    await bucket.delete(key)
    throw new SyncError(400, 'size_mismatch', 'The upload is not the size reserved')
  }

  const backup: BackupEntry = {
    id,
    sizeBytes: upload.sizeBytes,
    createdAt: Date.now(),
    appVersion: upload.appVersion,
    keyVersion: upload.keyVersion,
  }
  const record = await updateAccount(bucket, caller.accountId, (record) => {
    findPendingUpload(record, id)
    record.uploads = record.uploads.filter((entry) => entry.id !== id)
    record.backups = applyRetention(
      [...record.backups, backup],
      settings.limits.maxBackups,
      backup.createdAt
    ).kept
    return record
  })
  await sweepUnlistedObjects(bucket, caller.accountId, record)
  return backup
}
