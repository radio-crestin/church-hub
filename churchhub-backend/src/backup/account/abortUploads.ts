import { describeError } from '../describeError'
import type { BackupBucket } from '../storage/createBackupBucket'
import type { PendingUpload } from './AccountRecord'
import { userPartKey } from './accountKeys'
import { deleteObjects } from './deleteObjects'

/**
 * Cleans up uploads in the bucket: aborts the user part's multipart upload
 * and deletes what was sent (the manifest, and the blobs nobody needs).
 * Failures are logged without keys; the bucket's lifecycle rule and the
 * hourly upkeep catch the rest.
 */
export async function abortUploads(
  bucket: BackupBucket,
  accountId: string,
  blobPrefix: string,
  uploads: PendingUpload[],
  unreferencedBlobs: string[] = []
): Promise<void> {
  for (const upload of uploads) {
    await bucket
      .abortMultipartUpload(userPartKey(accountId, upload.id), upload.uploadId)
      .catch((error: unknown) => {
        console.error(`[backup] abort upload failed: ${describeError(error)}`)
      })
  }
  await deleteObjects(bucket, accountId, blobPrefix, {
    backupIds: uploads.map((upload) => upload.id),
    blobs: unreferencedBlobs,
  })
}
