import type { BackupBucket } from '../storage/createBackupBucket'
import type { AccountRecord } from './AccountRecord'
import { revokeAllSessions } from '../auth/backupSession'
import { updateAccountIndex } from './accountIndex'
import { accountRecordKey } from './accountKeys'
import { readAccount, updateAccount } from './accountStore'
import { listAccountObjects } from './sweepUnlistedObjects'
import { tombstoneOf, writeTombstone } from './tombstone'

/** A deletion still unfinished after this long is finished by the upkeep. */
export const STUCK_DELETION_MS = 15 * 60 * 1000

const PREFIXES = (accountId: string) => [
  `accounts/${accountId}/`,
  `backups/${accountId}/`,
  `blobs/${accountId}/`,
]

/** Thrown inside the compare-and-swap to leave the record as it is. */
class Skip extends Error {}

/** A record that is a real account (signed in once) or a deletion under way. */
const isAccount = (record: AccountRecord) =>
  record.createdAt !== null || record.deletingSince !== null

/**
 * Marks the record deleting (its sessions end) by compare-and-swap and
 * returns it as it was; null when there is no account to delete (no record
 * is created for one) or, with `expectEtag`, when the record changed since
 * it was read.
 */
async function markDeleting(
  bucket: BackupBucket,
  accountId: string,
  now: number,
  expectEtag?: string
): Promise<AccountRecord | null> {
  const mark = (record: AccountRecord) => {
    if (!isAccount(record)) throw new Skip()
    const snapshot = structuredClone(record)
    record.deletingSince ??= now
    revokeAllSessions(record, now)
    return snapshot
  }
  if (expectEtag !== undefined) {
    const { record, etag } = await readAccount(bucket, accountId)
    if (etag !== expectEtag || !isAccount(record)) return null
    const before = mark(record)
    const written = await bucket.put(accountRecordKey(accountId), JSON.stringify(record), {
      ifMatch: expectEtag,
    })
    return written === null ? null : before
  }
  try {
    return await updateAccount(bucket, accountId, mark)
  } catch (error) {
    if (error instanceof Skip) return null
    throw error
  }
}

/**
 * Erases an account, in an order no sign-in can slip into:
 * 1. the record is marked deleting and its sessions end (compare-and-swap;
 *    from here a sign-in is refused, 409); with no account there, nothing
 *    is written at all;
 * 2. the tombstone is written (the pause, an admin's quota, the last 24
 *    hours' uploads; nothing personal), merged into any earlier one,
 *    before anything is removed;
 * 3. every multipart upload under the account's prefixes is aborted and
 *    every object under accounts/<id>/, backups/<id>/ and blobs/<id>/ is
 *    deleted (an older layout included), and its admin index entry goes;
 * 4. the record goes last.
 * Running it again resumes an unfinished deletion; `expectEtag` (the
 * upkeep's) resumes it only if the record hasn't changed since it was read.
 */
export async function deleteAccount(
  bucket: BackupBucket,
  accountId: string,
  options: { expectEtag?: string } = {}
) {
  const now = Date.now()
  const before = await markDeleting(bucket, accountId, now, options.expectEtag)
  if (!before) return { deletedBackups: 0, before: null }
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
