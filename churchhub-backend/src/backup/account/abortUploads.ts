import type { BackupBucket } from '../storage/createBackupBucket'
import type { PendingUpload } from './AccountRecord'
import { backupObjectKey } from './accountKeys'

/**
 * Aborts uploads in the bucket, so their parts stop taking space. A failure
 * is logged (without the key) and left to the bucket's lifecycle rule.
 */
export async function abortUploads(
  bucket: BackupBucket,
  accountId: string,
  uploads: PendingUpload[]
): Promise<void> {
  for (const upload of uploads) {
    await bucket
      .abortMultipartUpload(backupObjectKey(accountId, upload.id), upload.uploadId)
      .catch((error: Error) => {
        console.error(`[backup] abort upload failed: ${error.message}`)
      })
  }
}
