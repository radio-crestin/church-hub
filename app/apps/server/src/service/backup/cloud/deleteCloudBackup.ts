import { cloudBackupRequest } from './cloudBackupRequest'

/** Deletes one of the account's cloud backups. */
export async function deleteCloudBackup(backupId: string): Promise<void> {
  await cloudBackupRequest(
    'DELETE',
    `/backup/backups/${encodeURIComponent(backupId)}`,
  )
}
