import type { CloudBackupFile, CloudBackupUsage } from './CloudBackupFile'
import { cloudBackupRequest } from './cloudBackupRequest'

/** The account's cloud backups (newest first) and its free-tier usage. */
export function listCloudBackups() {
  return cloudBackupRequest<{
    backups: CloudBackupFile[]
    usage: CloudBackupUsage
  }>('GET', '/backup/backups')
}
