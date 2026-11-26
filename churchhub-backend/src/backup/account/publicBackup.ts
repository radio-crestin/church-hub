import type { BackupEntry } from './AccountRecord'

/** A backup as the app lists it: its own size (user part + manifest). */
export function publicBackup(backup: BackupEntry) {
  return {
    id: backup.id,
    createdAt: backup.createdAt,
    appVersion: backup.appVersion,
    keyVersion: backup.keyVersion,
    sizeBytes: backup.userBytes + backup.manifestBytes,
    blobCount: backup.blobs.length,
  }
}
