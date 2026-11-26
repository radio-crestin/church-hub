import type { AccountRecord } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { accountPrefix, accountRecordKey } from './accountKeys'
import { updateAccount } from './accountStore'
import type { BackupContext } from './BackupContext'

/**
 * Deletes everything the account has: its backups, its uploads in flight
 * and its sessions. What stays is the record with no backups, only when
 * tokens stop being valid and the day's upload times (so deleting doesn't
 * reset the daily limit): no email, no Google id, no data.
 */
export async function deleteAccount({ bucket, caller }: BackupContext) {
  const before = await updateAccount<AccountRecord>(
    bucket,
    caller.accountId,
    (record) => {
      const snapshot = structuredClone(record)
      record.tokensValidAfter = Date.now()
      record.backups = []
      record.uploads = []
      return snapshot
    }
  )
  await abortUploads(bucket, caller.accountId, before.uploads)
  const keep = accountRecordKey(caller.accountId)
  const keys = await bucket.list(accountPrefix(caller.accountId))
  for (const key of keys.filter((key) => key !== keep)) {
    await bucket.delete(key)
  }
  return { deletedBackups: before.backups.length }
}
