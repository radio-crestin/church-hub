import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findBackup } from './findBackup'
import { requireBackupId } from './findPendingUpload'
import { sweepUnlistedObjects } from './sweepUnlistedObjects'

/** Deletes one of the caller's own backups: unlisted, then removed. */
export async function deleteBackup(
  { bucket, caller }: BackupContext,
  backupId: string | undefined
): Promise<void> {
  const id = requireBackupId(backupId)
  const record = await updateAccount(bucket, caller.accountId, (record) => {
    const backup = findBackup(record, id)
    record.backups = record.backups.filter((entry) => entry !== backup)
    return record
  })
  await sweepUnlistedObjects(bucket, caller.accountId, record)
}
