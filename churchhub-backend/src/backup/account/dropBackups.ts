import type { AccountRecord, BackupEntry } from './AccountRecord'
import { releaseBlobRefs } from './blobRefs'

/**
 * Unlists backups from the record (in place): their own bytes are freed
 * and their blob refs released. Returns the blobs nobody needs any more;
 * the caller deletes those objects and the backups' own.
 */
export function dropBackups(
  record: AccountRecord,
  dropped: BackupEntry[]
): string[] {
  record.backups = record.backups.filter((backup) => !dropped.includes(backup))
  const unreferenced: string[] = []
  for (const backup of dropped) {
    record.usedBytes -= backup.userBytes + backup.manifestBytes
    unreferenced.push(...releaseBlobRefs(record, backup.blobs))
  }
  record.usedBytes = Math.max(0, record.usedBytes)
  return unreferenced
}
