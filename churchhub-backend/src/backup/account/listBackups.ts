import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'

/** The caller's backups, newest first, and how much of the free tier they use. */
export async function listBackups({ bucket, settings, caller }: BackupContext) {
  const { record } = await readAccount(bucket, caller.accountId)
  const backups = [...record.backups].sort((a, b) => b.createdAt - a.createdAt)
  return {
    backups,
    usage: {
      usedBytes: backups.reduce((sum, backup) => sum + backup.sizeBytes, 0),
      ...settings.limits,
    },
  }
}
