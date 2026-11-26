import type { BackupLimits } from '../backupSettings'
import type { AccountRecord } from './AccountRecord'

/** The account's storage quota: an admin's override, else the global one. */
export function effectiveQuota(record: AccountRecord, limits: BackupLimits) {
  return record.quotaBytes ?? limits.quotaBytes
}
