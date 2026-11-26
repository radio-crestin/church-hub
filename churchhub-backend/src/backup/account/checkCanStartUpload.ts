import { SyncError } from '../../sync/SyncError'
import type { BackupLimits } from '../backupSettings'
import type { AccountRecord } from './AccountRecord'
import { applyRetention } from './applyRetention'

const DAY_MS = 24 * 60 * 60 * 1000
/** Uploads an account may have in flight at once. */
export const MAX_PENDING_UPLOADS = 2

/**
 * Refuses an upload over the free tier: too big, too many today, too many
 * in flight, or more storage than the account may hold once retention has
 * dropped what this backup replaces (uploads in flight count as reserved).
 */
export function checkCanStartUpload(
  record: AccountRecord,
  sizeBytes: number,
  limits: BackupLimits,
  now: number
): void {
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
  const { kept } = applyRetention(
    [
      ...record.backups,
      { id: '', sizeBytes, createdAt: now, appVersion: '', keyVersion: 0 },
    ],
    limits.maxBackups,
    now
  )
  const reserved = record.uploads.reduce((sum, u) => sum + u.sizeBytes, 0)
  const used = kept.reduce((sum, b) => sum + b.sizeBytes, 0) + reserved
  if (used > limits.quotaBytes) {
    throw new SyncError(413, 'quota_exceeded', 'The account’s storage is full', {
      quotaBytes: limits.quotaBytes,
    })
  }
}
