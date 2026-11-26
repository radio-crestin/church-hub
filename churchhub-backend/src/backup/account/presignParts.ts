import { SyncError } from '../../sync/SyncError'
import { PRESIGN_TTL_SECONDS } from '../storage/createBackupBucket'
import type { PendingUpload } from './AccountRecord'
import { backupObjectKey } from './accountKeys'
import { readAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { findPendingUpload, requireBackupId } from './findPendingUpload'

/** Part URLs handed out per request; the app asks again as it goes. */
const MAX_PARTS_PER_REQUEST = 50

/** A part's exact length: the part size, or what is left for the last one. */
export const partLength = (upload: PendingUpload, partNumber: number) =>
  partNumber < upload.partCount
    ? upload.partSize
    : upload.sizeBytes - upload.partSize * (upload.partCount - 1)

/**
 * Presigned PUT URLs (15 minutes) for parts of the caller's own upload in
 * flight. Each is signed for its exact Content-Length, so the store refuses
 * a part of any other size: the upload can't grow past what was reserved.
 */
export async function presignParts(
  { bucket, caller }: BackupContext,
  backupId: string | undefined,
  partNumbers: unknown
) {
  const id = requireBackupId(backupId)
  const { record } = await readAccount(bucket, caller.accountId)
  const upload = findPendingUpload(record, id)
  if (record.suspended) {
    throw new SyncError(403, 'suspended', 'Backups are paused for this account')
  }
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
    (partNumbers as number[]).map(async (partNumber) => {
      const sizeBytes = partLength(upload, partNumber)
      return {
        partNumber,
        sizeBytes,
        url: await bucket.presignUploadPart(key, upload.uploadId, partNumber, sizeBytes),
      }
    })
  )
  return { parts, expiresAt }
}
