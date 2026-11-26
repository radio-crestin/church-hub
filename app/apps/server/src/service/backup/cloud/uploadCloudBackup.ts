import { createReadStream, createWriteStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

import { sealManifest } from './backupManifest'
import type { CloudBackupFile } from './CloudBackupFile'
import { createEncryptStream } from './cipher/createEncryptStream'
import { updateCloudBackupSchedule } from './cloudBackupSchedule'
import { cloudTempPath } from './cloudTempPath'
import { getAccountKey } from './getAccountKey'
import {
  buildResourceBlobs,
  type ResourceBlob,
} from './resources/buildResourceBlobs'
import { planResources } from './resources/planResources'
import { stripResources } from './resources/stripResources'
import { runExclusive } from './runExclusive'
import { sha256File } from './sha256File'
import { uploadBackupFiles } from './uploadBackupFiles'
import { Database } from 'bun:sqlite'
import { createLogger } from '../../../utils/logger'
import { checkpointAndExport } from '../../database'

const logger = createLogger('backup')

/**
 * Splits a WAL-safe copy of the database into resource blobs (Bible texts,
 * library songs' slides: plaintext, content-addressed) and the church's own
 * data (resources/planResources), written as temp files; the copy keeps
 * only the church's data.
 */
async function splitCopy(plainPath: string) {
  const db = new Database(plainPath)
  try {
    const plan = planResources(db)
    const blobs = await buildResourceBlobs(db, plan, (hash) =>
      cloudTempPath(`cloud-blob-${hash.slice(0, 16)}`, 'gz'),
    )
    stripResources(db, plan)
    return blobs
  } finally {
    db.close()
  }
}

/**
 * Backs the database up to Church Hub Cloud. The church's own data is
 * gzipped and encrypted on this PC (cipher/backupFileFormat) under a fresh
 * key wrapped with the account key; the shared resources go as plaintext
 * blobs, sent only when the account doesn't store them yet; an encrypted
 * manifest ties them together. Nothing church-private leaves unencrypted.
 */
export function uploadCloudBackup(): Promise<CloudBackupFile> {
  return runExclusive(async () => {
    const plainPath = cloudTempPath('cloud-backup', 'db')
    const userPath = cloudTempPath('cloud-backup', 'chb')
    let blobs: ResourceBlob[] = []
    try {
      const { key, keyVersion } = await getAccountKey()
      const exported = await checkpointAndExport(plainPath)
      if (!exported.success) throw new Error(exported.error || 'export_failed')
      blobs = await splitCopy(plainPath)
      await pipeline(
        createReadStream(plainPath),
        createGzip(),
        createEncryptStream(key, keyVersion),
        createWriteStream(userPath),
      )
      await unlink(plainPath)
      const { size: userBytes } = await stat(userPath)
      const appVersion = process.env.APP_VERSION || 'dev'
      const manifest = await sealManifest(key, keyVersion, {
        format: 'church-hub-cloud-backup',
        version: 1,
        createdAt: Date.now(),
        appVersion,
        userPart: { sha256: await sha256File(userPath), sizeBytes: userBytes },
        blobs: blobs.map(({ hash, sizeBytes, label }) => ({
          hash,
          sizeBytes,
          label,
        })),
      })
      const backup = await uploadBackupFiles({
        userPath,
        userBytes,
        manifest,
        blobs,
        appVersion,
        keyVersion,
      })
      updateCloudBackupSchedule({ lastBackupAt: Date.now() })
      logger.info(
        `Cloud backup uploaded: ${userBytes} bytes of church data, ${backup.sentBlobs ?? 0} of ${blobs.length} resource blobs sent`,
      )
      return backup
    } finally {
      await unlink(plainPath).catch(() => {})
      await unlink(userPath).catch(() => {})
      for (const blob of blobs) await unlink(blob.path).catch(() => {})
    }
  })
}
