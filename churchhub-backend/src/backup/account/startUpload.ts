import { randomId } from '../../sync/randomId'
import { SyncError } from '../../sync/SyncError'
import type { AccountRecord, PendingUpload } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { userPartKey } from './accountKeys'
import { readAccount, updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'
import { takeBlobRefs } from './blobRefs'
import { checkCanStartUpload, uploadBytes } from './checkCanStartUpload'
import { ACCOUNT_KEY_VERSION } from './deriveAccountKey'
import { dropBackups } from './dropBackups'
import { deleteObjects } from './deleteObjects'
import { expiredBackups } from './expiredBackups'
import { UPLOAD_MAX_AGE_MS, takeExpiredUploads } from './takeExpiredUploads'

/** Each part of the user part, but the last (S3's minimum is 5 MiB). */
export const PART_SIZE = 16 * 1024 * 1024
const APP_VERSION = /^[0-9A-Za-z.+-]{1,32}$/
const SHA256 = /^[0-9a-f]{64}$/
/** Resource blobs one backup may reference. */
const MAX_BLOBS = 200
/** A manifest lists the blobs and the user part's hash: a few KB. */
const MAX_MANIFEST_BYTES = 256 * 1024

export interface StartUploadInput {
  userBytes?: unknown
  manifestBytes?: unknown
  blobs?: unknown
  appVersion?: unknown
  keyVersion?: unknown
}

const positiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0

/** The declared blobs: distinct SHA-256 hashes with positive sizes. */
function readBlobs(value: unknown): { hash: string; sizeBytes: number }[] {
  const blobs = Array.isArray(value) ? value : null
  const valid =
    blobs !== null &&
    blobs.length <= MAX_BLOBS &&
    blobs.every(
      (blob) =>
        typeof blob?.hash === 'string' &&
        SHA256.test(blob.hash) &&
        positiveInteger(blob.sizeBytes)
    ) &&
    new Set(blobs.map((blob) => blob.hash)).size === blobs.length
  if (!valid) {
    throw new SyncError(400, 'invalid_request', `blobs must be up to ${MAX_BLOBS} distinct { hash, sizeBytes }`)
  }
  return blobs.map((blob) => ({ hash: blob.hash, sizeBytes: blob.sizeBytes }))
}

/** Expired backups and uploads leave the record before anything is counted. */
function tidy(record: AccountRecord, retentionDays: number, now: number) {
  const uploads = takeExpiredUploads(record, now)
  const backups = expiredBackups(record, retentionDays, now)
  const blobs = [...uploads.unreferenced, ...dropBackups(record, backups)]
  return { expiredUploads: uploads.expired, expiredBackups: backups, blobs }
}

/**
 * Starts a backup: the user part and manifest (encrypted, its own) and the
 * resource blobs it references (plaintext, shared, by hash). Only blobs the
 * account hasn't stored are sent; the quota counts each blob once. Used +
 * reserved + what this upload adds may not pass the quota: then 413, and
 * nothing is deleted to make room. Every referenced blob gets a ref now,
 * so none can be deleted while this upload is in flight.
 */
export async function startUpload(
  { bucket, settings, caller }: BackupContext,
  input: StartUploadInput
) {
  const { userBytes, manifestBytes, appVersion, keyVersion } = input
  if (!positiveInteger(userBytes) || !positiveInteger(manifestBytes)) {
    throw new SyncError(400, 'invalid_request', 'userBytes and manifestBytes must be positive integers')
  }
  if (manifestBytes > MAX_MANIFEST_BYTES) {
    throw new SyncError(400, 'invalid_request', 'The manifest is too large')
  }
  if (keyVersion !== ACCOUNT_KEY_VERSION) {
    throw new SyncError(400, 'invalid_request', 'Unknown keyVersion')
  }
  const blobs = readBlobs(input.blobs)
  const sizes = new Map(blobs.map((blob) => [blob.hash, blob.sizeBytes]))
  const now = Date.now()
  const plan = (record: AccountRecord) => ({
    userBytes,
    manifestBytes,
    newBlobs: blobs.filter((blob) => !record.blobs[blob.hash]?.stored),
  })

  // Refuse early, on a copy, before anything is created in the bucket.
  const { record: preview } = await readAccount(bucket, caller.accountId)
  tidy(preview, settings.limits.retentionDays, now)
  checkCanStartUpload(preview, uploadBytes(plan(preview)), settings.limits, now)

  const id = randomId(16)
  const uploadId = await bucket.createMultipartUpload(userPartKey(caller.accountId, id))
  let outcome
  try {
    outcome = await updateAccount(bucket, caller.accountId, (record) => {
      const tidied = tidy(record, settings.limits.retentionDays, now)
      const declared = plan(record)
      checkCanStartUpload(record, uploadBytes(declared), settings.limits, now)
      const upload: PendingUpload = {
        id,
        uploadId,
        ...declared,
        partSize: PART_SIZE,
        partCount: Math.max(1, Math.ceil(userBytes / PART_SIZE)),
        blobs: blobs.map((blob) => blob.hash),
        appVersion:
          typeof appVersion === 'string' && APP_VERSION.test(appVersion)
            ? appVersion
            : 'unknown',
        keyVersion: ACCOUNT_KEY_VERSION,
        startedAt: now,
      }
      takeBlobRefs(record, upload.blobs, sizes)
      record.uploads.push(upload)
      record.uploadLog.push(now)
      return { tidied, upload, blobPrefix: record.blobPrefix }
    })
  } catch (error) {
    await bucket.abortMultipartUpload(userPartKey(caller.accountId, id), uploadId).catch(() => {})
    throw error
  }
  const { tidied, upload, blobPrefix } = outcome
  await abortUploads(bucket, caller.accountId, blobPrefix, tidied.expiredUploads, tidied.blobs)
  await deleteObjects(bucket, caller.accountId, blobPrefix, {
    backupIds: tidied.expiredBackups.map((backup) => backup.id),
  })
  return {
    backupId: id,
    partSize: upload.partSize,
    partCount: upload.partCount,
    /** The blobs to send: the others are already stored. */
    missingBlobs: upload.newBlobs.map((blob) => blob.hash),
    expiresAt: now + UPLOAD_MAX_AGE_MS,
  }
}
