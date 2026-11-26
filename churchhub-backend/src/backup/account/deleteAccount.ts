import { revokeAllSessions } from '../auth/backupSession'
import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'
import { abortUploads } from './abortUploads'
import { updateAccountIndex } from './accountIndex'
import { accountPrefix, accountRecordKey } from './accountKeys'
import { updateAccount } from './accountStore'

/**
 * Deletes everything an account has: its backups, uploads in flight,
 * sessions, email and its entry in the admin index. What stays is a record
 * with no data: when tokens stopped being valid, the day's upload times,
 * and an admin's quota or pause (so deleting resets neither limit).
 */
export async function deleteAccount(bucket: BackupBucket, accountId: string) {
  const before = await updateAccount<AccountRecord>(
    bucket,
    accountId,
    (record) => {
      const snapshot = structuredClone(record)
      revokeAllSessions(record)
      record.backups = []
      record.uploads = []
      record.usedBytes = 0
      record.email = null
      record.createdAt = null
      record.lastSignInAt = null
      record.lastBackupAt = null
      return snapshot
    }
  )
  await abortUploads(bucket, accountId, before.uploads)
  const keep = accountRecordKey(accountId)
  for (const { key } of await bucket.list(accountPrefix(accountId))) {
    if (key !== keep) await bucket.delete(key)
  }
  await updateAccountIndex(bucket, (index) => {
    delete index[accountId]
  })
  return { deletedBackups: before.backups.length, before }
}
