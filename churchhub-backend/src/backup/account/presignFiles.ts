import { SyncError } from '../../sync/SyncError'
import { PRESIGN_TTL_SECONDS } from '../storage/createBackupBucket'
import { blobKey, manifestKey } from './accountKeys'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'

const MAX_FILES_PER_REQUEST = 50

/**
 * Presigned PUT URLs (15 minutes) for the upload's whole files: `manifest`,
 * and each blob it must send (by hash). Each is signed for its declared
 * Content-Length, so the store refuses any other size. Blobs the account
 * already stores, or the upload didn't declare, get no URL.
 */
export async function presignFiles(
  { bucket, caller }: BackupContext,
  backupId: string | undefined,
  names: unknown
) {
  const id = requireBackupId(backupId)
  const { record } = await readAccount(bucket, caller.accountId)
  const upload = findPendingUpload(record, id)
  const sizes = new Map<string, number>([
    ['manifest', upload.manifestBytes],
    ...upload.newBlobs.map((blob) => [blob.hash, blob.sizeBytes] as [string, number]),
  ])
  if (
    !Array.isArray(names) ||
    names.length === 0 ||
    names.length > MAX_FILES_PER_REQUEST ||
    !names.every((name) => typeof name === 'string' && sizes.has(name))
  ) {
    throw new SyncError(400, 'invalid_request', 'files must be "manifest" or blobs this upload sends')
  }
  const files = await Promise.all(
    (names as string[]).map(async (name) => {
      const sizeBytes = sizes.get(name) as number
      const key =
        name === 'manifest'
          ? manifestKey(caller.accountId, id)
          : blobKey(caller.accountId, record.blobPrefix, name)
      return { name, sizeBytes, url: await bucket.presignPut(key, sizeBytes) }
    })
  )
  return { files, expiresAt: Date.now() + PRESIGN_TTL_SECONDS * 1000 }
}
