import { SyncError } from '../../sync/SyncError'
import type { AccountRecord, PendingUpload } from './AccountRecord'

const BACKUP_ID = /^[A-Za-z0-9_-]{22}$/

/** 400 unless `id` looks like a backup id (16 random bytes, base64url). */
export function requireBackupId(id: string | undefined): string {
  if (!id || !BACKUP_ID.test(id)) {
    throw new SyncError(400, 'invalid_request', 'Invalid backup id')
  }
  return id
}

/** The caller's own upload in flight, or 404: ids are only looked up there. */
export function findPendingUpload(
  record: AccountRecord,
  id: string
): PendingUpload {
  const upload = record.uploads.find((entry) => entry.id === id)
  if (!upload) throw new SyncError(404, 'not_found', 'No such upload')
  return upload
}
