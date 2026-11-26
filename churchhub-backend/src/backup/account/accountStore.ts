import { SyncError } from '../../sync/SyncError'
import type { BackupBucket } from '../storage/createBackupBucket'
import { type AccountRecord, emptyAccount } from './AccountRecord'
import { accountRecordKey } from './accountKeys'

/** Concurrent writes to one account retry this many times, then 503 busy. */
const MAX_ATTEMPTS = 5

/** The account's record, or an empty one before its first write. */
export async function readAccount(
  bucket: BackupBucket,
  accountId: string
): Promise<{ record: AccountRecord; etag: string | null }> {
  const found = await bucket.get(accountRecordKey(accountId))
  if (!found) return { record: emptyAccount(), etag: null }
  // Fields added later read as their defaults.
  const record = { ...emptyAccount(), ...(JSON.parse(found.text) as Partial<AccountRecord>) }
  return { record, etag: found.etag }
}

/**
 * Changes the account's record with a compare-and-swap on its ETag: when
 * another request wrote it first, it reads it again and retries. `change`
 * returns its result; it may throw a SyncError to refuse.
 */
export async function updateAccount<T>(
  bucket: BackupBucket,
  accountId: string,
  change: (record: AccountRecord) => T | Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { record, etag } = await readAccount(bucket, accountId)
    const result = await change(record)
    const written = await bucket.put(
      accountRecordKey(accountId),
      JSON.stringify(record),
      etag ? { ifMatch: etag } : { ifNoneMatch: '*' }
    )
    if (written !== null) return result
  }
  throw new SyncError(503, 'busy', 'Try again in a moment')
}
