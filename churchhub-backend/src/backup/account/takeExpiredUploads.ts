import type { AccountRecord, PendingUpload } from './AccountRecord'

/** An upload not finished in this long is dropped and aborted. */
export const UPLOAD_MAX_AGE_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Tidies the record in place: drops uploads left unfinished too long (the
 * caller aborts them in the bucket) and upload times older than a day.
 */
export function takeExpiredUploads(
  record: AccountRecord,
  now: number
): PendingUpload[] {
  const expired = record.uploads.filter(
    (upload) => now - upload.startedAt > UPLOAD_MAX_AGE_MS
  )
  record.uploads = record.uploads.filter((upload) => !expired.includes(upload))
  record.uploadLog = record.uploadLog.filter((at) => now - at < DAY_MS)
  return expired
}
