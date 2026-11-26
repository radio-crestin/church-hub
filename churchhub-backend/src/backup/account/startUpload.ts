import { randomId } from '../../sync/randomId'
import { SyncError } from '../../sync/SyncError'
import type { PendingUpload } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { backupObjectKey } from './accountKeys'
import { readAccount, updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { checkCanStartUpload } from './checkCanStartUpload'
import { ACCOUNT_KEY_VERSION } from './deriveAccountKey'
import { UPLOAD_MAX_AGE_MS, takeExpiredUploads } from './takeExpiredUploads'

/** Each part the app uploads, but the last (S3's minimum is 5 MiB). */
export const PART_SIZE = 16 * 1024 * 1024
const APP_VERSION = /^[0-9A-Za-z.+-]{1,32}$/

export interface StartUploadInput {
  sizeBytes?: unknown
  appVersion?: unknown
  keyVersion?: unknown
}

/**
 * Starts a backup upload within the free tier: a multipart upload in the
 * bucket, recorded as pending with its size reserved. The app then asks
 * for presigned part URLs and uploads straight to the bucket.
 */
export async function startUpload(
  { bucket, settings, caller }: BackupContext,
  input: StartUploadInput
) {
  const { sizeBytes, appVersion, keyVersion } = input
  if (!Number.isSafeInteger(sizeBytes) || (sizeBytes as number) <= 0) {
    throw new SyncError(400, 'invalid_request', 'sizeBytes must be a positive integer')
  }
  if (keyVersion !== ACCOUNT_KEY_VERSION) {
    throw new SyncError(400, 'invalid_request', 'Unknown keyVersion')
  }
  const size = sizeBytes as number
  const now = Date.now()
  // Refuse early, before anything is created in the bucket.
  const { record: current } = await readAccount(bucket, caller.accountId)
  takeExpiredUploads(current, now)
  checkCanStartUpload(current, size, settings.limits, now)

  const id = randomId(16)
  const key = backupObjectKey(caller.accountId, id)
  const uploadId = await bucket.createMultipartUpload(key)
  const upload: PendingUpload = {
    id,
    uploadId,
    sizeBytes: size,
    partSize: PART_SIZE,
    partCount: Math.max(1, Math.ceil(size / PART_SIZE)),
    appVersion:
      typeof appVersion === 'string' && APP_VERSION.test(appVersion)
        ? appVersion
        : 'unknown',
    keyVersion: ACCOUNT_KEY_VERSION,
    startedAt: now,
  }
  let expired: PendingUpload[] = []
  try {
    await updateAccount(bucket, caller.accountId, (record) => {
      expired = takeExpiredUploads(record, now)
      checkCanStartUpload(record, size, settings.limits, now)
      record.uploads.push(upload)
      record.uploadLog.push(now)
    })
  } catch (error) {
    await abortUploads(bucket, caller.accountId, [upload])
    throw error
  }
  await abortUploads(bucket, caller.accountId, expired)
  return {
    backupId: id,
    partSize: upload.partSize,
    partCount: upload.partCount,
    expiresAt: now + UPLOAD_MAX_AGE_MS,
  }
}
