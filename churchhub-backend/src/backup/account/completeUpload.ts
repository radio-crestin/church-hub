import { SyncError } from '../../sync/SyncError'
import type { BackupEntry, PendingUpload } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { blobKey, manifestKey, userPartKey } from './accountKeys'
import { readAccount, updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { effectiveQuota } from './effectiveQuota'
import { findPendingUpload, requireBackupId } from './findPendingUpload'
import { publicBackup } from './publicBackup'
import { dropUpload } from './takeExpiredUploads'

/** Drops the upload: its refs released, its objects and unneeded blobs deleted. */
async function abandon(context: BackupContext, upload: PendingUpload) {
  const { bucket, caller } = context
  const { unreferenced, blobPrefix } = await updateAccount(
    bucket,
    caller.accountId,
    (record) => ({
      unreferenced: record.uploads.some((u) => u.id === upload.id)
        ? dropUpload(record, upload)
        : [],
      blobPrefix: record.blobPrefix,
    })
  )
  await abortUploads(bucket, caller.accountId, blobPrefix, [upload], unreferenced)
}

/**
 * Finishes the caller's upload. The manifest and every blob it had to send
 * must be in the bucket at their declared sizes (missing: 409, so the app
 * sends them and asks again), and the user part's parts must add up to its
 * declared size. Sizes are read from the bucket, never taken from the
 * client: a wrong one aborts the upload. Then, in one compare-and-swap, the
 * backup is listed, its new blobs marked stored and the usage counter
 * grows by what was really added; past the quota (an admin may have
 * lowered it meanwhile) the upload is dropped and refused.
 */
export async function completeUpload(
  context: BackupContext,
  backupId: string | undefined
) {
  const { bucket, settings, caller } = context
  const id = requireBackupId(backupId)
  const { record: current } = await readAccount(bucket, caller.accountId)
  const upload = findPendingUpload(current, id)

  const files = [
    { name: 'manifest', key: manifestKey(caller.accountId, id), sizeBytes: upload.manifestBytes },
    ...upload.newBlobs.map((blob) => ({
      name: blob.hash,
      key: blobKey(caller.accountId, current.blobPrefix, blob.hash),
      sizeBytes: blob.sizeBytes,
    })),
  ]
  const actual = await Promise.all(files.map((file) => bucket.size(file.key)))
  const missing = files.filter((_, i) => actual[i] === null).map((f) => f.name)
  if (files.some((file, i) => actual[i] !== null && actual[i] !== file.sizeBytes)) {
    await abandon(context, upload)
    throw new SyncError(400, 'size_mismatch', 'A file is not the size declared')
  }
  if (missing.length > 0) {
    throw new SyncError(409, 'upload_incomplete', 'Some files are missing', { missing })
  }

  const userKey = userPartKey(caller.accountId, id)
  const parts = (await bucket.listParts(userKey, upload.uploadId)).sort(
    (a, b) => a.partNumber - b.partNumber
  )
  const total = parts.reduce((sum, part) => sum + part.size, 0)
  if (total > upload.userBytes || parts.some((p) => p.partNumber > upload.partCount)) {
    await abandon(context, upload)
    throw new SyncError(400, 'size_mismatch', 'The user part is larger than declared')
  }
  if (total !== upload.userBytes || parts.length !== upload.partCount) {
    throw new SyncError(409, 'upload_incomplete', 'Some parts are missing', {
      uploadedParts: parts.map((part) => part.partNumber),
    })
  }
  await bucket.completeMultipartUpload(userKey, upload.uploadId, parts)
  if ((await bucket.size(userKey)) !== upload.userBytes) {
    await abandon(context, upload)
    throw new SyncError(400, 'size_mismatch', 'The user part is not the size declared')
  }

  const now = Date.now()
  const outcome = await updateAccount(bucket, caller.accountId, (record) => {
    const pending = findPendingUpload(record, id)
    const added =
      pending.userBytes +
      pending.manifestBytes +
      pending.newBlobs
        .filter((blob) => !record.blobs[blob.hash]?.stored)
        .reduce((sum, blob) => sum + blob.sizeBytes, 0)
    if (record.usedBytes + added > effectiveQuota(record, settings.limits)) {
      return { refused: true as const, unreferenced: dropUpload(record, pending), blobPrefix: record.blobPrefix }
    }
    record.uploads = record.uploads.filter((entry) => entry.id !== id)
    for (const blob of pending.newBlobs) {
      const entry = record.blobs[blob.hash]
      if (entry && !entry.stored) {
        entry.stored = true
        entry.sizeBytes = blob.sizeBytes
      }
    }
    record.usedBytes += added
    const backup: BackupEntry = {
      id,
      createdAt: now,
      appVersion: pending.appVersion,
      keyVersion: pending.keyVersion,
      userBytes: pending.userBytes,
      manifestBytes: pending.manifestBytes,
      blobs: pending.blobs,
    }
    record.backups.push(backup)
    record.lastBackupAt = now
    return { refused: false as const, backup }
  })
  if (outcome.refused) {
    await abortUploads(bucket, caller.accountId, outcome.blobPrefix, [upload], outcome.unreferenced)
    throw new SyncError(413, 'quota_exceeded', 'The account’s storage is full')
  }
  return publicBackup(outcome.backup)
}
