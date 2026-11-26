import type { BackupBucket } from '../storage/createBackupBucket'
import { readAccount, updateAccount } from './accountStore'
import { deleteObjects } from './deleteObjects'
import { dropBackups } from './dropBackups'
import { expiredBackups } from './expiredBackups'

/**
 * Removes the account's backups older than the retention: unlisted (bytes
 * freed, blob refs released) by compare-and-swap, then their objects and
 * the blobs nobody needs deleted. Returns how many expired.
 */
export async function expireAccountBackups(
  bucket: BackupBucket,
  accountId: string,
  retentionDays: number,
  now = Date.now()
): Promise<number> {
  const { record: preview } = await readAccount(bucket, accountId)
  if (expiredBackups(preview, retentionDays, now).length === 0) return 0
  const { expired, unreferenced, blobPrefix } = await updateAccount(
    bucket,
    accountId,
    (record) => {
      const expired = expiredBackups(record, retentionDays, now)
      return { expired, unreferenced: dropBackups(record, expired), blobPrefix: record.blobPrefix }
    }
  )
  await deleteObjects(bucket, accountId, blobPrefix, {
    backupIds: expired.map((backup) => backup.id),
    blobs: unreferenced,
  })
  return expired.length
}
