import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'
import { revokeAllSessions } from '../auth/backupSession'
import { updateAccountIndex } from './accountIndex'
import { accountRecordKey } from './accountKeys'
import { updateAccount } from './accountStore'
import { listAccountObjects } from './sweepUnlistedObjects'

const PREFIXES = (accountId: string) => [
  `accounts/${accountId}/`,
  `backups/${accountId}/`,
  `blobs/${accountId}/`,
]

/**
 * Erases an account entirely. First its sessions end (compare-and-swap,
 * so no request in flight can add anything); then every multipart upload
 * under its prefixes is aborted, every object under accounts/<id>/,
 * backups/<id>/ and blobs/<id>/ is deleted (an older layout included), its
 * entry leaves the admin index, and its record goes last. Nothing is left:
 * a later sign-in starts a new, empty account.
 */
export async function deleteAccount(bucket: BackupBucket, accountId: string) {
  const before = await updateAccount<AccountRecord>(bucket, accountId, (record) => {
    const snapshot = structuredClone(record)
    revokeAllSessions(record)
    record.backups = []
    record.uploads = []
    record.blobs = {}
    record.usedBytes = 0
    return snapshot
  })
  for (const prefix of PREFIXES(accountId)) {
    for (const upload of await bucket.listMultipartUploads(prefix)) {
      await bucket.abortMultipartUpload(upload.key, upload.uploadId)
    }
  }
  const record = accountRecordKey(accountId)
  for (const { key } of await listAccountObjects(bucket, accountId)) {
    if (key !== record) await bucket.delete(key)
  }
  await updateAccountIndex(bucket, (index) => {
    delete index[accountId]
  })
  await bucket.delete(record)
  return { deletedBackups: before.backups.length, before }
}
