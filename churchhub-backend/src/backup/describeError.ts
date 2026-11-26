import { SyncError } from '../sync/SyncError'

/** The storage client's own messages: `S3 <operation> failed: [status] <code>`. */
const S3_FAILURE = /^S3 ([A-Za-z]{1,40}) failed: (?:(\d{3}) )?([A-Za-z0-9.]{1,64})$/

/**
 * An error as the backup code may log it: its name, plus a known code (the
 * service's own, or the S3 operation, status and error code), never its
 * message. Messages can carry object keys (an account's blob prefix), URLs
 * or an email; names and these codes can't.
 */
export function describeError(error: unknown): string {
  if (error instanceof SyncError) return `SyncError ${error.code}`
  if (!(error instanceof Error)) return 'unknown error'
  const s3 = error.message.match(S3_FAILURE)
  return s3
    ? [error.name, 'S3', s3[1], s3[2], s3[3]].filter(Boolean).join(' ')
    : error.name
}
