import { SyncError } from '../../sync/SyncError'
import type { BackupLimits } from '../backupSettings'
import type { AccountRecord, PendingUpload } from './AccountRecord'
import { effectiveQuota } from './effectiveQuota'

const DAY_MS = 24 * 60 * 60 * 1000
/** Uploads an account may have in flight at once. */
export const MAX_PENDING_UPLOADS = 2

/** What an upload will add to the bucket: its own parts and its new blobs. */
export const uploadBytes = (upload: Pick<PendingUpload, 'userBytes' | 'manifestBytes' | 'newBlobs'>) =>
  upload.userBytes +
  upload.manifestBytes +
  upload.newBlobs.reduce((sum, blob) => sum + blob.sizeBytes, 0)

/** Bytes reserved by the account's uploads in flight. */
export const reservedBytes = (record: AccountRecord) =>
  record.uploads.reduce((sum, upload) => sum + uploadBytes(upload), 0)

/**
 * Refuses an upload the account may not start: paused by an admin, over
 * the size of one upload, too many today or in flight, or past its quota
 * (used + reserved + this one). Nothing is deleted to make room: backups
 * leave only when they expire or are deleted. The quota refusal names the
 * numbers, so the app can say how much is free.
 */
export function checkCanStartUpload(
  record: AccountRecord,
  neededBytes: number,
  limits: BackupLimits,
  now: number
): void {
  if (record.suspended) {
    throw new SyncError(403, 'suspended', 'Backups are paused for this account')
  }
  if (neededBytes > limits.maxBackupBytes) {
    throw new SyncError(413, 'too_large', 'The backup is over the size limit', {
      maxBackupBytes: limits.maxBackupBytes,
    })
  }
  const today = record.uploadLog.filter((at) => now - at < DAY_MS)
  if (today.length >= limits.uploadsPerDay) {
    throw new SyncError(429, 'daily_limit', 'Too many backups today')
  }
  if (record.uploads.length >= MAX_PENDING_UPLOADS) {
    throw new SyncError(409, 'upload_in_progress', 'A backup is uploading')
  }
  const quotaBytes = effectiveQuota(record, limits)
  if (record.usedBytes + reservedBytes(record) + neededBytes > quotaBytes) {
    throw new SyncError(413, 'quota_exceeded', 'The account’s storage is full', {
      usedBytes: record.usedBytes,
      reservedBytes: reservedBytes(record),
      neededBytes,
      quotaBytes,
    })
  }
}
