import { randomId } from '../sync/randomId'
import type { BackupBucket } from '../backup/storage/createBackupBucket'

const PREFIX = 'admin/audit/'
/** Keys sort newest first: the time counts down from this. */
const LAST_MS = 9_999_999_999_999

/** One admin call: who, what, on which account, when, and what changed. */
export interface AuditEntry {
  /** Unix ms. */
  at: number
  /** The admin's email, or null when the caller wasn't a signed-in admin. */
  admin: string | null
  action: string
  /** The account id acted on, if any. */
  target: string | null
  /** The HTTP status the call was answered with. */
  status: number
  before?: unknown
  after?: unknown
}

/**
 * Appends an entry: a new object that is never overwritten (If-None-Match:
 * *) and never deleted by the service, so the log only grows.
 */
export async function appendAudit(
  bucket: BackupBucket,
  entry: AuditEntry
): Promise<void> {
  const key = `${PREFIX}${String(LAST_MS - entry.at).padStart(13, '0')}-${randomId(6)}.json`
  await bucket.put(key, JSON.stringify(entry), { ifNoneMatch: '*' })
}

/** The newest `limit` entries, newest first. */
export async function readAudit(
  bucket: BackupBucket,
  limit: number
): Promise<AuditEntry[]> {
  const objects = await bucket.list(PREFIX, limit)
  const entries = await Promise.all(
    objects.map(async ({ key }) => {
      const found = await bucket.get(key)
      return found ? (JSON.parse(found.text) as AuditEntry) : null
    })
  )
  return entries.filter((entry): entry is AuditEntry => entry !== null)
}
