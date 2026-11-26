import type { BackupLimits } from '../backupSettings'
import type { AccountRecord, BackupEntry } from './AccountRecord'
import { applyRetention } from './applyRetention'
import { fitsQuota } from './checkCanStartUpload'

/**
 * When `sizeBytes` doesn't fit, drops from the record (in place) the
 * backups retention would remove once this one is in, and frees their
 * bytes; the caller deletes their objects. Nothing is dropped when it
 * already fits, so a failed upload never costs an old backup needlessly.
 */
export function makeRoom(
  record: AccountRecord,
  sizeBytes: number,
  limits: BackupLimits,
  now: number
): BackupEntry[] {
  if (fitsQuota(record, sizeBytes, limits)) return []
  const incoming: BackupEntry = {
    id: '',
    sizeBytes,
    createdAt: now,
    appVersion: '',
    keyVersion: 0,
  }
  const { removed } = applyRetention(
    [...record.backups, incoming],
    limits.maxBackups,
    now
  )
  const dropped = removed.filter((backup) => backup !== incoming)
  record.backups = record.backups.filter((backup) => !dropped.includes(backup))
  record.usedBytes -= dropped.reduce((sum, backup) => sum + backup.sizeBytes, 0)
  return dropped
}
