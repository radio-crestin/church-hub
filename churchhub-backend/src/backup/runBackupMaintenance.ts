import type { Bindings } from '../types'
import { readAccountIndex } from './account/accountIndex'
import { expireAccountBackups } from './account/expireAccountBackups'
import { reconcileAccount } from './account/reconcileAccount'
import { UPLOAD_MAX_AGE_MS } from './account/takeExpiredUploads'
import { readBackupSettings } from './backupSettings'
import {
  type BackupBucket,
  createBackupBucket,
  type StoredObject,
} from './storage/createBackupBucket'

/** The account id of a `backups/<id>/…` or `blobs/<id>/…` key. */
const OWNER = /^(?:backups|blobs)\/([0-9a-f]{64})\//

/** Aborts multipart uploads left unfinished past their time, in every account. */
async function abortStaleUploads(bucket: BackupBucket, now: number) {
  const stale = (await bucket.listMultipartUploads('backups/')).filter(
    (upload) => now - upload.initiatedAt > UPLOAD_MAX_AGE_MS
  )
  for (const upload of stale) {
    await bucket.abortMultipartUpload(upload.key, upload.uploadId)
  }
  return stale.length
}

/** Every account that signed in, or still has objects. */
async function knownAccounts(bucket: BackupBucket, objects: StoredObject[] = []) {
  const { index } = await readAccountIndex(bucket)
  const owners = objects.map((o) => o.key.match(OWNER)?.[1]).filter(Boolean) as string[]
  return [...new Set([...Object.keys(index), ...owners])]
}

/** Recomputes every account from one listing of the bucket. */
async function reconcileAll(bucket: BackupBucket, retentionDays: number) {
  const objects = [...(await bucket.list('backups/')), ...(await bucket.list('blobs/'))]
  const byAccount = new Map<string, StoredObject[]>()
  for (const object of objects) {
    const owner = object.key.match(OWNER)?.[1]
    if (owner) byAccount.set(owner, [...(byAccount.get(owner) ?? []), object])
  }
  const accounts = await knownAccounts(bucket, objects)
  for (const accountId of accounts) {
    await reconcileAccount(bucket, accountId, retentionDays, byAccount.get(accountId) ?? [])
  }
  return accounts.length
}

/** Expires backups past the retention in every account. */
async function expireAll(bucket: BackupBucket, retentionDays: number) {
  let expired = 0
  for (const accountId of await knownAccounts(bucket)) {
    expired += await expireAccountBackups(bucket, accountId, retentionDays)
  }
  return expired
}

/**
 * The backup service's scheduled upkeep, the same on Cloudflare (cron
 * triggers) and Node (timers). Every hour: multipart uploads left
 * unfinished are aborted and backups past the retention (30 days) expire.
 * Once a day (`reconcile`): every account is recomputed from the bucket.
 * Skipped quietly while cloud backup is not configured; failures are
 * logged without keys.
 */
export async function runBackupMaintenance(
  env: Bindings,
  options: { reconcile: boolean }
): Promise<void> {
  let settings
  try {
    settings = readBackupSettings(env)
  } catch {
    return
  }
  const bucket = createBackupBucket(settings.bucket)
  const { retentionDays } = settings.limits
  try {
    const aborted = await abortStaleUploads(bucket, Date.now())
    const expired = await expireAll(bucket, retentionDays)
    const reconciled = options.reconcile ? await reconcileAll(bucket, retentionDays) : 0
    console.log(
      `[backup] maintenance: ${aborted} stale uploads aborted, ${expired} backups expired, ${reconciled} accounts reconciled`
    )
  } catch (error) {
    console.error(
      `[backup] maintenance failed: ${error instanceof Error ? error.message : 'unknown'}`
    )
  }
}
