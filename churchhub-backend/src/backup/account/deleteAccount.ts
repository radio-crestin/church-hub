import { randomId } from '../../sync/randomId'
import { revokeAllSessions } from '../auth/backupSession'
import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'
import { updateAccountIndex } from './accountIndex'
import { accountBackupsPrefix, accountBlobsPrefix, userPartKey } from './accountKeys'
import { updateAccount } from './accountStore'

/**
 * Deletes everything an account has: its backups, blobs, uploads in
 * flight, sessions, email and its entry in the admin index (the blob
 * prefix is renewed too). What stays is a record with no data: when tokens
 * stopped being valid, the day's upload times, and an admin's quota or
 * pause (so deleting resets neither limit).
 */
export async function deleteAccount(bucket: BackupBucket, accountId: string) {
  const before = await updateAccount<AccountRecord>(bucket, accountId, (record) => {
    const snapshot = structuredClone(record)
    revokeAllSessions(record)
    record.backups = []
    record.uploads = []
    record.blobs = {}
    record.blobPrefix = randomId(16)
    record.usedBytes = 0
    record.email = null
    record.createdAt = null
    record.lastSignInAt = null
    record.lastBackupAt = null
    return snapshot
  })
  for (const upload of before.uploads) {
    await bucket
      .abortMultipartUpload(userPartKey(accountId, upload.id), upload.uploadId)
      .catch(() => {})
  }
  for (const prefix of [accountBackupsPrefix(accountId), accountBlobsPrefix(accountId)]) {
    for (const { key } of await bucket.list(prefix)) await bucket.delete(key)
  }
  await updateAccountIndex(bucket, (index) => {
    delete index[accountId]
  })
  return { deletedBackups: before.backups.length, before }
}
