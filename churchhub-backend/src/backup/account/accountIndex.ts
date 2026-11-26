import { SyncError } from '../../sync/SyncError'
import type { BackupBucket } from '../storage/createBackupBucket'

const INDEX_KEY = 'index/accounts.json'
const MAX_ATTEMPTS = 8

/** What the admin panel lists and searches each account by. */
export interface AccountIndexEntry {
  email: string
  createdAt: number
  lastSignInAt: number
}

export type AccountIndex = Record<string, AccountIndexEntry>

/** Every account that ever signed in, by account id (one small object). */
export async function readAccountIndex(
  bucket: BackupBucket
): Promise<{ index: AccountIndex; etag: string | null }> {
  const found = await bucket.get(INDEX_KEY)
  return found
    ? { index: JSON.parse(found.text) as AccountIndex, etag: found.etag }
    : { index: {}, etag: null }
}

/** Changes the index with a compare-and-swap on its ETag, retrying on a race. */
export async function updateAccountIndex(
  bucket: BackupBucket,
  change: (index: AccountIndex) => void
): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { index, etag } = await readAccountIndex(bucket)
    change(index)
    const written = await bucket.put(
      INDEX_KEY,
      JSON.stringify(index),
      etag ? { ifMatch: etag } : { ifNoneMatch: '*' }
    )
    if (written !== null) return
  }
  throw new SyncError(503, 'busy', 'Try again in a moment')
}
