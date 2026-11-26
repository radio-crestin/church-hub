import { CloudBackupError } from './CloudBackupError'

/**
 * A failure as the cloud backup code logs it: its code, or the error's
 * name; never a raw message, which can hold a presigned URL, a token or an
 * email.
 */
export function logSafeError(error: unknown): string {
  if (error instanceof CloudBackupError) return error.code
  return error instanceof Error ? error.name : 'unknown error'
}
