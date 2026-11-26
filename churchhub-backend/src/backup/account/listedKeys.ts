import type { AccountRecord } from './AccountRecord'
import { accountRecordKey, blobKey, manifestKey, userPartKey } from './accountKeys'

/** Every object the account's record accounts for: anything else is stray. */
export function listedKeys(accountId: string, record: AccountRecord): Set<string> {
  return new Set([
    accountRecordKey(accountId),
    ...[...record.backups, ...record.uploads].flatMap((entry) => [
      userPartKey(accountId, entry.id),
      manifestKey(accountId, entry.id),
    ]),
    ...Object.keys(record.blobs).map((hash) => blobKey(accountId, record.blobPrefix, hash)),
  ])
}
