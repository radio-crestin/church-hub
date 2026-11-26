import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { deleteObjects } from './deleteObjects'
import { dropBackups } from './dropBackups'
import { findBackup } from './findBackup'
import { requireBackupId } from './findPendingUpload'

/**
 * Deletes one of the caller's own backups: unlisted, its bytes freed, its
 * blob refs released; then its objects and the blobs nobody needs go.
 */
export async function deleteBackup(
  { bucket, caller }: BackupContext,
  backupId: string | undefined
): Promise<void> {
  const id = requireBackupId(backupId)
  const { unreferenced, blobPrefix } = await updateAccount(bucket, caller.accountId, (record) => ({
    unreferenced: dropBackups(record, [findBackup(record, id)]),
    blobPrefix: record.blobPrefix,
  }))
  await deleteObjects(bucket, caller.accountId, blobPrefix, {
    backupIds: [id],
    blobs: unreferenced,
  })
}
