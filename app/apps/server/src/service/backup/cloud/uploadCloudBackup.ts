import { createReadStream, createWriteStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

import type { CloudBackupFile } from './CloudBackupFile'
import { createEncryptStream } from './cipher/createEncryptStream'
import { updateCloudBackupSchedule } from './cloudBackupSchedule'
import { getAccountKey } from './getAccountKey'
import { runExclusive } from './runExclusive'
import { uploadEncryptedFile } from './uploadEncryptedFile'
import { createLogger } from '../../../utils/logger'
import { getDataDir } from '../../../utils/paths'
import { checkpointAndExport } from '../../database'

const logger = createLogger('backup')

/**
 * Backs the database up to Church Hub Cloud: a WAL-safe copy, gzipped and
 * encrypted on this PC (cipher/backupFileFormat) under a fresh key wrapped
 * with the account key, then uploaded straight to the bucket in parts.
 * Only ciphertext leaves the PC.
 */
export function uploadCloudBackup(): Promise<CloudBackupFile> {
  return runExclusive(async () => {
    const stamp = Date.now()
    const plainPath = join(getDataDir(), `.cloud-backup-${stamp}.db`)
    const sealedPath = join(getDataDir(), `.cloud-backup-${stamp}.chb`)
    try {
      const { key, keyVersion } = await getAccountKey()
      const exported = await checkpointAndExport(plainPath)
      if (!exported.success) throw new Error(exported.error || 'export_failed')
      await pipeline(
        createReadStream(plainPath),
        createGzip(),
        createEncryptStream(key, keyVersion),
        createWriteStream(sealedPath),
      )
      await unlink(plainPath)
      const { size } = await stat(sealedPath)
      const appVersion = process.env.APP_VERSION || 'dev'
      const backup = await uploadEncryptedFile(
        sealedPath,
        size,
        appVersion,
        keyVersion,
      )
      updateCloudBackupSchedule({ lastBackupAt: Date.now() })
      logger.info(`Cloud backup uploaded (${size} bytes)`)
      return backup
    } finally {
      await unlink(plainPath).catch(() => {})
      await unlink(sealedPath).catch(() => {})
    }
  })
}
