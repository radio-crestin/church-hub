import { SyncError } from '../../sync/SyncError'
import { FILE_PUT_TTL_SECONDS } from '../storage/createBackupBucket'
import { blobKey, manifestKey } from './accountKeys'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'

const MAX_FILES_PER_REQUEST = 50
/** What every whole-file PUT must send: the URL is signed with it. */
const CREATE_ONLY = { 'If-None-Match': '*' }

/**
 * Presigned PUT URLs (5 minutes) for the files of the caller's own upload
 * in flight: `manifest`, and each blob it declared that the account's
 * record still has unstored. Each is signed for its declared
 * Content-Length and for `If-None-Match: *`, so the store refuses another
 * size and never overwrites an object (a stored blob stays as it is).
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
    ...upload.newBlobs
      .filter((blob) => record.blobs[blob.hash]?.stored === false)
      .map((blob) => [blob.hash, blob.sizeBytes] as [string, number]),
  ])
  if (
    !Array.isArray(names) ||
    names.length === 0 ||
    names.length > MAX_FILES_PER_REQUEST ||
    !names.every((name) => typeof name === 'string' && sizes.has(name))
  ) {
    throw new SyncError(
      400,
      'invalid_request',
      'files must be "manifest" or blobs this upload sends that are not stored'
    )
  }
  const files = await Promise.all(
    (names as string[]).map(async (name) => {
      const sizeBytes = sizes.get(name) as number
      const key =
        name === 'manifest'
          ? manifestKey(caller.accountId, id)
          : blobKey(caller.accountId, record.blobPrefix, name)
      return {
        name,
        sizeBytes,
        headers: CREATE_ONLY,
        url: await bucket.presignCreate(key, sizeBytes),
      }
    })
  )
  return { files, expiresAt: Date.now() + FILE_PUT_TTL_SECONDS * 1000 }
}
