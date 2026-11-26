import { createReadStream, createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import { CloudBackupError } from './CloudBackupError'
import { createDecryptStream } from './cipher/createDecryptStream'
import {
  readCloudBackupCredential,
  saveCloudBackupCredential,
} from './cloudBackupCredential'
import { cloudBackupRequest } from './cloudBackupRequest'
import { cloudTempPath } from './cloudTempPath'
import { getAccountKey } from './getAccountKey'
import { runExclusive } from './runExclusive'
import { createLogger } from '../../../utils/logger'
import { importDatabase } from '../../database'

const logger = createLogger('backup')
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000

/** Streams the backup from its presigned URL to a file. */
async function download(backupId: string, path: string): Promise<number> {
  const { url, keyVersion } = await cloudBackupRequest<{
    url: string
    keyVersion: number
  }>('POST', `/backup/backups/${encodeURIComponent(backupId)}/download`)
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  }).catch(() => null)
  if (!response?.ok) throw new CloudBackupError('download_failed')
  await Bun.write(path, response)
  return keyVersion
}

/**
 * Restores a cloud backup: downloads it, decrypts and checks it on this PC
 * (any change to the file fails as backup_unreadable), then swaps it in
 * with importDatabase, which keeps the current database to fall back on.
 * This PC stays signed in as it was: the restored file's own sign-in, if
 * any, is replaced by the current one.
 */
export function restoreCloudBackup(backupId: string) {
  return runExclusive(async () => {
    const sealedPath = cloudTempPath('cloud-restore', 'chb')
    const plainPath = cloudTempPath('cloud-restore', 'db')
    try {
      const keyVersion = await download(backupId, sealedPath)
      const { key } = await getAccountKey()
      await pipeline(
        createReadStream(sealedPath),
        createDecryptStream(key, keyVersion),
        createGunzip(),
        createWriteStream(plainPath),
      ).catch(() => {
        throw new CloudBackupError('backup_unreadable', 422)
      })
      const signedIn = readCloudBackupCredential()
      const result = await importDatabase(plainPath)
      saveCloudBackupCredential(signedIn)
      if (!result.success) {
        logger.error(`Cloud restore failed: ${result.message}`)
        throw new CloudBackupError('restore_failed', 500)
      }
      logger.info('Cloud backup restored')
      return { requiresRestart: result.requiresRestart }
    } finally {
      await unlink(sealedPath).catch(() => {})
      await unlink(plainPath).catch(() => {})
    }
  })
}
