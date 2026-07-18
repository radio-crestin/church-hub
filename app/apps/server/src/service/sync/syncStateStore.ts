import { getRawDatabase } from '../../db'

export interface SyncState {
  deviceId: string
  remoteFileId: string | null
  remoteFileVersion: string | null
}

/** Reads the singleton sync engine state row (created by the add-sync migration). */
export function getSyncState(): SyncState {
  const db = getRawDatabase()
  const row = db
    .query<
      {
        device_id: string
        remote_file_id: string | null
        remote_file_version: string | null
      },
      []
    >(
      'SELECT device_id, remote_file_id, remote_file_version FROM sync_state WHERE id = 1',
    )
    .get()

  if (!row) {
    throw new Error('sync_state row missing — add-sync migration did not run')
  }
  return {
    deviceId: row.device_id,
    remoteFileId: row.remote_file_id,
    remoteFileVersion: row.remote_file_version,
  }
}

/** Persists the Drive file id/version seen at the last successful sync. */
export function updateRemoteFileRef(
  fileId: string | null,
  fileVersion: string | null,
): void {
  const db = getRawDatabase()
  db.query(
    'UPDATE sync_state SET remote_file_id = ?, remote_file_version = ?, updated_at = unixepoch() WHERE id = 1',
  ).run(fileId, fileVersion)
}

/**
 * Runs `fn` with the change-tracking triggers suppressed (`applying = 1`), so
 * writes that merely apply remote changes are not re-recorded as local edits.
 * Always restores the flag, even when `fn` throws.
 */
export function withTriggersSuppressed<T>(fn: () => T): T {
  const db = getRawDatabase()
  db.query('UPDATE sync_state SET applying = 1 WHERE id = 1').run()
  try {
    return fn()
  } finally {
    db.query('UPDATE sync_state SET applying = 0 WHERE id = 1').run()
  }
}
