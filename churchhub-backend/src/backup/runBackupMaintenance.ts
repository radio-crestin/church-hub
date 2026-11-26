import type { Bindings } from '../types'
import { readAccountIndex } from './account/accountIndex'
import { readAccount } from './account/accountStore'
import { deleteAccount, STUCK_DELETION_MS } from './account/deleteAccount'
import { expireAccountBackups } from './account/expireAccountBackups'
import { reconcileAccount } from './account/reconcileAccount'
import { sweepUnlistedObjects } from './account/sweepUnlistedObjects'
import { UPLOAD_MAX_AGE_MS } from './account/takeExpiredUploads'
import { purgeOldTombstones } from './account/tombstone'
import { readBackupSettings } from './backupSettings'
import { describeError } from './describeError'
import {
  type BackupBucket,
  createBackupBucket,
  type StoredObject,
} from './storage/createBackupBucket'

/** The account id of an `accounts/<id>/…`, `backups/<id>/…` or `blobs/<id>/…` key. */
const OWNER = /^(?:accounts|backups|blobs)\/([0-9a-f]{64})\//

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

/** Every object of the backup service, by account, and every account known. */
async function accountsWithObjects(bucket: BackupBucket) {
  const objects = [
    ...(await bucket.list('accounts/')),
    ...(await bucket.list('backups/')),
    ...(await bucket.list('blobs/')),
  ]
  const byAccount = new Map<string, StoredObject[]>()
  for (const object of objects) {
    const owner = object.key.match(OWNER)?.[1]
    if (owner) byAccount.set(owner, [...(byAccount.get(owner) ?? []), object])
  }
  const { index } = await readAccountIndex(bucket)
  for (const accountId of Object.keys(index)) {
    if (!byAccount.has(accountId)) byAccount.set(accountId, [])
  }
  return byAccount
}

/**
 * Runs `work` for each account on its own: one account's failure (a bad
 * record, a storage error) is logged with its account id (a keyed hash,
 * never an email) and the others go on. Returns how many succeeded.
 */
async function eachAccount(
  accounts: Map<string, StoredObject[]>,
  step: string,
  work: (accountId: string, objects: StoredObject[]) => Promise<unknown>
) {
  let done = 0
  for (const [accountId, objects] of accounts) {
    try {
      await work(accountId, objects)
      done++
    } catch (error) {
      console.error(
        `[backup] ${step} failed for account ${accountId.slice(0, 12)}: ${describeError(error)}`
      )
    }
  }
  return done
}

/**
 * The backup service's scheduled upkeep, the same on Cloudflare (cron
 * triggers) and Node (timers). Every hour: multipart uploads left
 * unfinished are aborted, backups past the retention (30 days) expire,
 * objects no record lists (older than any presigned URL) are swept,
 * account deletions left unfinished are finished, and tombstones of
 * deleted accounts older than 90 days are purged. Once a
 * day (`reconcile`): every account is recomputed from the bucket. Each
 * account is handled on its own; skipped quietly while cloud backup is not
 * configured.
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
    const accounts = await accountsWithObjects(bucket)
    const tidied = await eachAccount(accounts, 'upkeep', async (accountId, objects) => {
      const { record } = await readAccount(bucket, accountId)
      if (record.deletingSince !== null && Date.now() - record.deletingSince > STUCK_DELETION_MS) {
        await deleteAccount(bucket, accountId)
        return
      }
      await expireAccountBackups(bucket, accountId, retentionDays)
      await sweepUnlistedObjects(bucket, accountId, objects)
    })
    const purged = await purgeOldTombstones(bucket)
    const reconciled = options.reconcile
      ? await eachAccount(accounts, 'reconcile', (accountId, objects) =>
          reconcileAccount(bucket, accountId, retentionDays, objects)
        )
      : 0
    console.log(
      `[backup] maintenance: ${aborted} stale uploads aborted, ${tidied} accounts tidied, ${purged} tombstones purged, ${reconciled} reconciled`
    )
  } catch (error) {
    console.error(
      `[backup] maintenance failed: ${describeError(error)}`
    )
  }
}
