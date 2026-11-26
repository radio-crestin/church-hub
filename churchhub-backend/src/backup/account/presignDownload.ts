import { PRESIGN_TTL_SECONDS } from '../storage/createBackupBucket'
import { backupObjectKey } from './accountKeys'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findBackup } from './findBackup'
import { requireBackupId } from './findPendingUpload'

/** A presigned GET (15 minutes) for one of the caller's own backups. */
export async function presignDownload(
  { bucket, caller }: BackupContext,
  backupId: string | undefined
) {
  const id = requireBackupId(backupId)
  const { record } = await readAccount(bucket, caller.accountId)
  const backup = findBackup(record, id)
  return {
    url: await bucket.presignDownload(backupObjectKey(caller.accountId, id)),
    expiresAt: Date.now() + PRESIGN_TTL_SECONDS * 1000,
    sizeBytes: backup.sizeBytes,
    keyVersion: backup.keyVersion,
  }
}
