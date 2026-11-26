import { SyncError } from '../../sync/SyncError'
import { PRESIGN_TTL_SECONDS } from '../storage/createBackupBucket'
import { backupObjectKey } from './accountKeys'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'

/** Part URLs handed out per request; the app asks again as it goes. */
const MAX_PARTS_PER_REQUEST = 50

/**
 * Presigned PUT URLs (15 minutes) for parts of the caller's own upload in
 * flight, so the backup goes straight to the bucket, never through here.
 */
export async function presignParts(
  { bucket, caller }: BackupContext,
  backupId: string | undefined,
  partNumbers: unknown
) {
  const id = requireBackupId(backupId)
  const { record } = await readAccount(bucket, caller.accountId)
  const upload = findPendingUpload(record, id)
  if (
    !Array.isArray(partNumbers) ||
    partNumbers.length === 0 ||
    partNumbers.length > MAX_PARTS_PER_REQUEST ||
    new Set(partNumbers).size !== partNumbers.length ||
    !partNumbers.every(
      (n) => Number.isInteger(n) && n >= 1 && n <= upload.partCount
    )
  ) {
    throw new SyncError(
      400,
      'invalid_request',
      `partNumbers must be 1-${MAX_PARTS_PER_REQUEST} distinct parts of 1-${upload.partCount}`
    )
  }
  const key = backupObjectKey(caller.accountId, id)
  const expiresAt = Date.now() + PRESIGN_TTL_SECONDS * 1000
  const parts = await Promise.all(
    (partNumbers as number[]).map(async (partNumber) => ({
      partNumber,
      url: await bucket.presignUploadPart(key, upload.uploadId, partNumber),
    }))
  )
  return { parts, expiresAt }
}
