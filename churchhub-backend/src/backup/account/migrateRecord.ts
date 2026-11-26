import type { AccountRecord } from './AccountRecord'
import { emptyAccount } from './AccountRecord'

type Legacy = Record<string, unknown> & { sizeBytes?: number }

/**
 * A stored record in today's shape, whatever version wrote it: fields added
 * later read as their defaults, and a version-1 record (one encrypted file
 * per backup, no blobs) gets its sizes moved to userBytes, no manifest and
 * no blob references. Nothing in upkeep or deletion then trips on an older
 * record.
 */
export function migrateRecord(stored: Partial<AccountRecord> & Legacy): AccountRecord {
  const record = { ...emptyAccount(), ...stored, version: 2 } as AccountRecord
  record.blobs = stored.blobs ?? {}
  record.backups = (stored.backups ?? []).map((backup) => {
    const legacy = backup as typeof backup & Legacy
    return {
      ...backup,
      userBytes: backup.userBytes ?? legacy.sizeBytes ?? 0,
      manifestBytes: backup.manifestBytes ?? 0,
      blobs: backup.blobs ?? [],
    }
  })
  record.uploads = (stored.uploads ?? []).map((upload) => {
    const legacy = upload as typeof upload & Legacy
    return {
      ...upload,
      userBytes: upload.userBytes ?? legacy.sizeBytes ?? 0,
      manifestBytes: upload.manifestBytes ?? 0,
      blobs: upload.blobs ?? [],
      newBlobs: upload.newBlobs ?? [],
    }
  })
  return record
}
