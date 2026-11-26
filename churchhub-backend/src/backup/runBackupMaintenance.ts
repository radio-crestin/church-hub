import type { Bindings } from '../types'
import { readAccountIndex } from './account/accountIndex'
import { reconcileAccount } from './account/reconcileAccount'
import { UPLOAD_MAX_AGE_MS } from './account/takeExpiredUploads'
import { readBackupSettings } from './backupSettings'
import { createBackupBucket, type StoredObject } from './storage/createBackupBucket'

const ACCOUNT_KEY = /^accounts\/([0-9a-f]{64})\/backups\//

/** Aborts multipart uploads left unfinished past their time, in every account. */
async function abortStaleUploads(
  bucket: ReturnType<typeof createBackupBucket>,
  now: number
): Promise<number> {
  const stale = (await bucket.listMultipartUploads('accounts/')).filter(
    (upload) => now - upload.initiatedAt > UPLOAD_MAX_AGE_MS
  )
  for (const upload of stale) {
    await bucket.abortMultipartUpload(upload.key, upload.uploadId)
  }
  return stale.length
}

/** Recomputes every account's usage from one listing of the bucket. */
async function reconcileAll(
  bucket: ReturnType<typeof createBackupBucket>
): Promise<number> {
  const byAccount = new Map<string, StoredObject[]>()
  for (const object of await bucket.list('accounts/')) {
    const accountId = object.key.match(ACCOUNT_KEY)?.[1]
    if (accountId) byAccount.set(accountId, [...(byAccount.get(accountId) ?? []), object])
  }
  const { index } = await readAccountIndex(bucket)
  const accounts = new Set([...byAccount.keys(), ...Object.keys(index)])
  for (const accountId of accounts) {
    await reconcileAccount(bucket, accountId, byAccount.get(accountId) ?? [])
  }
  return accounts.size
}

/**
 * The backup service's scheduled upkeep, the same on Cloudflare (cron
 * triggers) and Node (timers): every hour, multipart uploads left
 * unfinished are aborted; once a day (`reconcile`), every account's usage
 * is recomputed from the bucket. Skipped quietly while cloud backup is not
 * configured; failures are logged without keys.
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
  try {
    const aborted = await abortStaleUploads(bucket, Date.now())
    const reconciled = options.reconcile ? await reconcileAll(bucket) : 0
    console.log(
      `[backup] maintenance: ${aborted} stale uploads aborted, ${reconciled} accounts reconciled`
    )
  } catch (error) {
    console.error(
      `[backup] maintenance failed: ${error instanceof Error ? error.message : 'unknown'}`
    )
  }
}
