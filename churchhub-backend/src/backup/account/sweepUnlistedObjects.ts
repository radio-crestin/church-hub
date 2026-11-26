import { type BackupBucket, PRESIGN_TTL_SECONDS, type StoredObject } from '../storage/createBackupBucket'
import { accountBackupsPrefix, accountBlobsPrefix } from './accountKeys'
import { readAccount } from './accountStore'
import { listedKeys } from './listedKeys'

/**
 * An unlisted object younger than the longest presigned URL may still be
 * written through one; older, it is stray for good.
 */
export const SWEEP_AFTER_MS = PRESIGN_TTL_SECONDS * 1000

/** Everything the account may have in the bucket, under its three prefixes. */
export async function listAccountObjects(bucket: BackupBucket, accountId: string) {
  return [
    ...(await bucket.list(`accounts/${accountId}/`)),
    ...(await bucket.list(accountBackupsPrefix(accountId))),
    ...(await bucket.list(accountBlobsPrefix(accountId))),
  ]
}

/**
 * Deletes the account's objects its record doesn't list, once older than
 * any presigned URL could write them: files of aborted, refused or expired
 * uploads (even sent after the abort, through a URL still valid then),
 * blobs nobody needs, and any older layout under accounts/<id>/. Runs
 * hourly. Returns how many were deleted.
 */
export async function sweepUnlistedObjects(
  bucket: BackupBucket,
  accountId: string,
  objects?: StoredObject[],
  now = Date.now()
): Promise<number> {
  const stored = objects ?? (await listAccountObjects(bucket, accountId))
  const { record } = await readAccount(bucket, accountId)
  const keep = listedKeys(accountId, record)
  const stray = stored.filter(
    (object) => !keep.has(object.key) && now - object.lastModified >= SWEEP_AFTER_MS
  )
  for (const { key } of stray) await bucket.delete(key)
  return stray.length
}
