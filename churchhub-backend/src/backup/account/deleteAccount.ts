import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'
import { revokeAllSessions } from '../auth/backupSession'
import { updateAccountIndex } from './accountIndex'
import { accountRecordKey } from './accountKeys'
import { updateAccount } from './accountStore'
import { listAccountObjects } from './sweepUnlistedObjects'
import { tombstoneOf, writeTombstone } from './tombstone'

/** A deletion still unfinished after this long is finished by the upkeep. */
export const STUCK_DELETION_MS = 15 * 60 * 1000

const PREFIXES = (accountId: string) => [
  `accounts/${accountId}/`,
  `backups/${accountId}/`,
  `blobs/${accountId}/`,
]

/**
 * Erases an account, in an order no sign-in can slip into:
 * 1. the record is marked deleting and its sessions end (compare-and-swap;
 *    from here a sign-in is refused, 409);
 * 2. the tombstone is written (the pause, an admin's quota, the last 24
 *    hours' uploads; nothing personal), before anything is removed;
 * 3. every multipart upload under the account's prefixes is aborted and
 *    every object under accounts/<id>/, backups/<id>/ and blobs/<id>/ is
 *    deleted (an older layout included), and its admin index entry goes;
 * 4. the record goes last.
 * Running it again resumes an unfinished deletion. A later sign-in with the
 * same account starts a new record and takes the tombstone's limits back.
 */
export async function deleteAccount(bucket: BackupBucket, accountId: string) {
  const now = Date.now()
  const before = await updateAccount<AccountRecord>(bucket, accountId, (record) => {
    const snapshot = structuredClone(record)
    record.deletingSince ??= now
    revokeAllSessions(record, now)
    return snapshot
  })
  await writeTombstone(bucket, accountId, tombstoneOf(before, now))
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
