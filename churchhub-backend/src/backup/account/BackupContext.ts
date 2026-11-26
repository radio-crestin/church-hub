import type { BackupCaller } from '../auth/backupSession'
import type { BackupSettings } from '../backupSettings'
import type { BackupBucket } from '../storage/createBackupBucket'

/** What an authenticated backup request works with: only its own account. */
export interface BackupContext {
  bucket: BackupBucket
  settings: BackupSettings
  caller: BackupCaller
}
