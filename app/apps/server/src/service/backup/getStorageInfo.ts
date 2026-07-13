import { stat } from 'node:fs/promises'
import type { drive_v3 } from 'googleapis'

import { createLogger } from '../../utils/logger'
import { getDatabasePath } from '../../utils/paths'

const logger = createLogger('backup')

export interface BackupStorageInfo {
  /** Total Drive quota in bytes; null when the account has unlimited storage. */
  limitBytes: number | null
  /** Bytes currently used across the whole Drive account. */
  usageBytes: number
  /** Free Drive space in bytes; null when the account has unlimited storage. */
  availableBytes: number | null
  /** Current database size — the approximate size of the next backup. */
  dbSizeBytes: number
  /** True when the free Drive space cannot fit another backup. */
  insufficientSpace: boolean
}

/**
 * Reads the connected account's Drive storage quota (`about.get`, allowed with
 * the `drive.appdata` scope) and compares the free space against the current
 * database size, so callers can warn before a backup would fail.
 *
 * Returns null when the quota cannot be read; storage info is advisory and must
 * never block the backup flow on its own.
 */
export async function getStorageInfo(
  drive: drive_v3.Drive,
): Promise<BackupStorageInfo | null> {
  try {
    const res = await drive.about.get({ fields: 'storageQuota' })
    const quota = res.data.storageQuota

    const dbSizeBytes = await stat(getDatabasePath())
      .then((s) => s.size)
      .catch(() => 0)

    const limitBytes = quota?.limit ? Number(quota.limit) : null
    const usageBytes = quota?.usage ? Number(quota.usage) : 0
    const availableBytes =
      limitBytes !== null ? Math.max(limitBytes - usageBytes, 0) : null

    return {
      limitBytes,
      usageBytes,
      availableBytes,
      dbSizeBytes,
      insufficientSpace:
        availableBytes !== null && availableBytes < dbSizeBytes,
    }
  } catch (error) {
    logger.warning(`Failed to read Drive storage quota: ${error}`)
    return null
  }
}
