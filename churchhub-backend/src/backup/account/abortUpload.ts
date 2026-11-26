import type { PendingUpload } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'

/** Cancels the caller's upload in flight and frees its reserved size. */
export async function abortUpload(
  { bucket, caller }: BackupContext,
  backupId: string | undefined
): Promise<void> {
  const id = requireBackupId(backupId)
  const upload = await updateAccount<PendingUpload>(
    bucket,
    caller.accountId,
    (record) => {
      const found = findPendingUpload(record, id)
      record.uploads = record.uploads.filter((entry) => entry !== found)
      return found
    }
  )
  await abortUploads(bucket, caller.accountId, [upload])
}
