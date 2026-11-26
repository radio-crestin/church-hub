import { abortUploads } from './abortUploads'
import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'
import { dropUpload } from './takeExpiredUploads'

/** Cancels the caller's upload in flight: its reservation and refs are released. */
export async function abortUpload(
  { bucket, caller }: BackupContext,
  backupId: string | undefined
): Promise<void> {
  const id = requireBackupId(backupId)
  const { upload, unreferenced, blobPrefix } = await updateAccount(
    bucket,
    caller.accountId,
    (record) => {
      const found = findPendingUpload(record, id)
      return { upload: found, unreferenced: dropUpload(record, found), blobPrefix: record.blobPrefix }
    }
  )
  await abortUploads(bucket, caller.accountId, blobPrefix, [upload], unreferenced)
}
