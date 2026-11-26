import type { Context } from 'hono'
import { SyncError } from '../sync/SyncError'

const TOKEN = /\bchb[agr]_[A-Za-z0-9_.-]+/g
const ACCOUNT_PATH = /accounts\/[0-9a-f]{64}\/[^\s"'<]*/g

/** A message with backup tokens and account paths cut out. */
export function redactBackupSecrets(text: string): string {
  return text
    .replace(TOKEN, 'chb_<redacted>')
    .replace(ACCOUNT_PATH, 'accounts/<redacted>')
}

/**
 * Every error a /backup route raises, as `{ error, code, ...details }`. An
 * unexpected one is logged without tokens or object keys (storage errors
 * name only the operation and S3's code; the rest is redacted too).
 */
export function handleBackupError(error: Error, c: Context): Response {
  if (error instanceof SyncError) {
    return c.json(
      { error: error.message, code: error.code, ...error.details },
      error.status
    )
  }
  console.error(
    '[backup] request failed:',
    redactBackupSecrets(error.stack ?? String(error))
  )
  return c.json({ error: 'Internal server error', code: 'internal' }, 500)
}
