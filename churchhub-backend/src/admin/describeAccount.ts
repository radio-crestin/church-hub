import type { AccountRecord } from '../backup/account/AccountRecord'
import { reservedBytes } from '../backup/account/checkCanStartUpload'
import { effectiveQuota } from '../backup/account/effectiveQuota'
import type { BackupLimits } from '../backup/backupSettings'

/** An account as the admin panel shows it in its table. */
export function describeAccount(
  accountId: string,
  record: AccountRecord,
  limits: BackupLimits
) {
  return {
    id: accountId,
    email: record.email,
    createdAt: record.createdAt,
    lastSignInAt: record.lastSignInAt,
    lastBackupAt: record.lastBackupAt,
    lastReconciledAt: record.lastReconciledAt,
    backupCount: record.backups.length,
    blobCount: Object.keys(record.blobs).length,
    usedBytes: record.usedBytes,
    reservedBytes: reservedBytes(record),
    quotaBytes: effectiveQuota(record, limits),
    quotaOverride: record.quotaBytes,
    suspended: record.suspended,
    sessions: Object.keys(record.sessions).length,
  }
}
