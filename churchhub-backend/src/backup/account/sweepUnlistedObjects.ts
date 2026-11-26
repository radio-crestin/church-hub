import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'
import { accountPrefix, backupObjectKey } from './accountKeys'

/**
 * Deletes the account's backup objects its record no longer lists: what
 * retention or a delete dropped, and anything a failed delete left behind.
 * Failures are logged without keys; the next sweep tries again.
 */
export async function sweepUnlistedObjects(
  bucket: BackupBucket,
  accountId: string,
  record: AccountRecord
): Promise<void> {
  const listed = new Set(
    [...record.backups, ...record.uploads].map((entry) =>
      backupObjectKey(accountId, entry.id)
    )
  )
  const keys = await bucket.list(`${accountPrefix(accountId)}backups/`)
  for (const key of keys.filter((key) => !listed.has(key))) {
    await bucket.delete(key).catch((error: Error) => {
      console.error(`[backup] delete failed: ${error.message}`)
    })
  }
}
