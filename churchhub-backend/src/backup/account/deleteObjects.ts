import type { BackupBucket } from '../storage/createBackupBucket'
import { blobKey, manifestKey, userPartKey } from './accountKeys'

/**
 * Deletes the objects of backups (or uploads) by id and of blobs by hash.
 * Failures are logged without keys; the daily reconcile removes leftovers.
 */
export async function deleteObjects(
  bucket: BackupBucket,
  accountId: string,
  blobPrefix: string,
  objects: { backupIds?: string[]; blobs?: string[] }
): Promise<void> {
  const keys = [
    ...(objects.backupIds ?? []).flatMap((id) => [
      userPartKey(accountId, id),
      manifestKey(accountId, id),
    ]),
    ...(objects.blobs ?? []).map((hash) => blobKey(accountId, blobPrefix, hash)),
  ]
  for (const key of keys) {
    await bucket.delete(key).catch((error: Error) => {
      console.error(`[backup] delete failed: ${error.message}`)
    })
  }
}
