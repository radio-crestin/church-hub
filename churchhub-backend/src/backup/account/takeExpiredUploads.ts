import type { AccountRecord, PendingUpload } from './AccountRecord'
import { releaseBlobRefs } from './blobRefs'

/** An upload not finished in this long is dropped and aborted. */
export const UPLOAD_MAX_AGE_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Drops an upload in flight from the record (in place): its blob refs are
 * released. Returns the blobs nobody needs any more.
 */
export function dropUpload(record: AccountRecord, upload: PendingUpload): string[] {
  record.uploads = record.uploads.filter((entry) => entry.id !== upload.id)
  return releaseBlobRefs(record, upload.blobs)
}

/**
 * Tidies the record in place: drops uploads left unfinished too long and
 * upload times older than a day. Returns the expired uploads and the blobs
 * they leave unreferenced; the caller aborts and deletes them.
 */
export function takeExpiredUploads(record: AccountRecord, now: number) {
  const expired = record.uploads.filter(
    (upload) => now - upload.startedAt > UPLOAD_MAX_AGE_MS
  )
  const unreferenced = expired.flatMap((upload) => dropUpload(record, upload))
  record.uploadLog = record.uploadLog.filter((at) => now - at < DAY_MS)
  return { expired, unreferenced }
}
