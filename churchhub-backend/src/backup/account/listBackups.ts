import type { BackupLimits } from '../backupSettings'
import type { AccountRecord } from './AccountRecord'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { reservedBytes } from './checkCanStartUpload'
import { effectiveQuota } from './effectiveQuota'

/** How much of its quota the account uses, and the free tier's limits. */
export function usageOf(record: AccountRecord, limits: BackupLimits) {
  return {
    usedBytes: record.usedBytes,
    reservedBytes: reservedBytes(record),
    quotaBytes: effectiveQuota(record, limits),
    maxBackupBytes: limits.maxBackupBytes,
    maxBackups: limits.maxBackups,
    uploadsPerDay: limits.uploadsPerDay,
    suspended: record.suspended,
  }
}

/** The caller's backups, newest first, and its usage. */
export async function listBackups({ bucket, settings, caller }: BackupContext) {
  const { record } = await readAccount(bucket, caller.accountId)
  return {
    backups: [...record.backups].sort((a, b) => b.createdAt - a.createdAt),
    usage: usageOf(record, settings.limits),
  }
}
