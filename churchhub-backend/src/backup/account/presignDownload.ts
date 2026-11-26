import { PRESIGN_TTL_SECONDS } from '../storage/createBackupBucket'
import { blobKey, manifestKey, userPartKey } from './accountKeys'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findBackup } from './findBackup'
import { requireBackupId } from './findPendingUpload'

/**
 * Presigned GETs (15 minutes) for one of the caller's own backups: its
 * manifest, its user part and every blob it references. The bucket stays
 * private and unlisted; a blob is reachable only through such a URL.
 */
export async function presignDownload(
  { bucket, caller }: BackupContext,
  backupId: string | undefined
) {
  const id = requireBackupId(backupId)
  const { record } = await readAccount(bucket, caller.accountId)
  const backup = findBackup(record, id)
  return {
    manifestUrl: await bucket.presignGet(manifestKey(caller.accountId, id)),
    userPartUrl: await bucket.presignGet(userPartKey(caller.accountId, id)),
    blobs: await Promise.all(
      backup.blobs.map(async (hash) => ({
        hash,
        url: await bucket.presignGet(blobKey(caller.accountId, record.blobPrefix, hash)),
      }))
    ),
    keyVersion: backup.keyVersion,
    expiresAt: Date.now() + PRESIGN_TTL_SECONDS * 1000,
  }
}
