import { SyncError } from '../../sync/SyncError'
import type { BackupLimits } from '../backupSettings'
import type { AccountRecord } from './AccountRecord'
import { effectiveQuota } from './effectiveQuota'

const DAY_MS = 24 * 60 * 60 * 1000
/** Uploads an account may have in flight at once. */
export const MAX_PENDING_UPLOADS = 2

/** Bytes reserved by the account's uploads in flight. */
export const reservedBytes = (record: AccountRecord) =>
  record.uploads.reduce((sum, upload) => sum + upload.sizeBytes, 0)

/** True when `sizeBytes` more fits: used + reserved + it, within the quota. */
export const fitsQuota = (
  record: AccountRecord,
  sizeBytes: number,
  limits: BackupLimits
) =>
  record.usedBytes + reservedBytes(record) + sizeBytes <=
  effectiveQuota(record, limits)

/**
 * Refuses an upload the account may not start: paused by an admin, over
 * the size of one backup, too many today or in flight, or more than its
 * quota (used + reserved + this one). The quota refusal names the numbers,
 * so the app can say how much is free.
 */
export function checkCanStartUpload(
  record: AccountRecord,
  sizeBytes: number,
  limits: BackupLimits,
  now: number
): void {
  if (record.suspended) {
    throw new SyncError(403, 'suspended', 'Backups are paused for this account')
  }
  if (sizeBytes > limits.maxBackupBytes) {
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
  if (!fitsQuota(record, sizeBytes, limits)) {
    throw new SyncError(413, 'quota_exceeded', 'The account’s storage is full', {
      usedBytes: record.usedBytes,
      reservedBytes: reservedBytes(record),
      neededBytes: sizeBytes,
      quotaBytes: effectiveQuota(record, limits),
    })
  }
}
