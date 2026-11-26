import { SyncError } from '../../sync/SyncError'
import type { AccountRecord, BackupEntry } from './AccountRecord'

/** The caller's own backup, or 404: ids are only looked up in their record. */
export function findBackup(record: AccountRecord, id: string): BackupEntry {
  const backup = record.backups.find((entry) => entry.id === id)
  if (!backup) throw new SyncError(404, 'not_found', 'No such backup')
  return backup
}
