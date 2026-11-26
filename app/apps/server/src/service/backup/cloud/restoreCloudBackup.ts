import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, readFileSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { createGunzip, gunzipSync } from 'node:zlib'

import { openManifest } from './backupManifest'
import { CloudBackupError } from './CloudBackupError'
import { createDecryptStream } from './cipher/createDecryptStream'
import {
  readCloudBackupCredential,
  saveCloudBackupCredential,
} from './cloudBackupCredential'
import { cloudBackupRequest } from './cloudBackupRequest'
import { cloudTempPath } from './cloudTempPath'
import { getAccountKey } from './getAccountKey'
import { applyResourceBlob } from './resources/applyResourceBlob'
import { RESOURCE_TABLES } from './resources/planResources'
import { parseSections } from './resources/resourceBlobFormat'
import { withoutTriggers } from './resources/withoutTriggers'
import { runExclusive } from './runExclusive'
import { sha256File } from './sha256File'
import { Database } from 'bun:sqlite'
import { createLogger } from '../../../utils/logger'
import { rebuildSearchIndex as rebuildBibleSearchIndex } from '../../bible'
import { importDatabase } from '../../database'
import { rebuildSearchIndex as rebuildSongSearchIndex } from '../../songs'

const logger = createLogger('backup')
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000

const unreadable = () => new CloudBackupError('backup_unreadable', 422)

interface DownloadUrls {
  manifestUrl: string
  userPartUrl: string
  blobs: { hash: string; url: string }[]
  keyVersion: number
}

async function fetchTo(url: string, path: string): Promise<void> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  }).catch(() => null)
  if (!response?.ok) throw new CloudBackupError('download_failed')
  await Bun.write(path, response)
}

/** Each blob the manifest lists, downloaded and checked against its hash. */
async function downloadBlobs(
  wanted: string[],
  urls: Map<string, string>,
  pathFor: (hash: string) => string,
): Promise<string[]> {
  const paths: string[] = []
  for (const hash of wanted) {
    const url = urls.get(hash)
    if (!url) throw unreadable()
    const path = pathFor(hash)
    paths.push(path)
    await fetchTo(url, path)
    const contents = gunzipSync(readFileSync(path))
    if (createHash('sha256').update(contents).digest('hex') !== hash) {
      throw unreadable()
    }
  }
  return paths
}

/**
 * Restores a cloud backup. The manifest is decrypted; the user part must
 * match the hash it names, then is decrypted; every resource blob must
 * match its own hash. Any difference fails as backup_unreadable before
 * anything is replaced. The church's data and the resources are put back
 * together in a temp copy (triggers and foreign keys left out), swapped in
 * with importDatabase (the current database is kept to fall back on), and
 * the search indexes are rebuilt. This PC stays signed in as it was.
 */
export function restoreCloudBackup(backupId: string) {
  return runExclusive(async () => {
    const sealedPath = cloudTempPath('cloud-restore', 'chb')
    const plainPath = cloudTempPath('cloud-restore', 'db')
    let blobPaths: string[] = []
    try {
      const urls = await cloudBackupRequest<DownloadUrls>(
        'POST',
        `/backup/backups/${encodeURIComponent(backupId)}/download`,
      )
      const { key } = await getAccountKey()
      const manifestResponse = await fetch(urls.manifestUrl).catch(() => null)
      if (!manifestResponse?.ok) throw new CloudBackupError('download_failed')
      const manifest = await openManifest(
        key,
        urls.keyVersion,
        Buffer.from(await manifestResponse.arrayBuffer()),
      ).catch(() => {
        throw unreadable()
      })

      await fetchTo(urls.userPartUrl, sealedPath)
      if ((await sha256File(sealedPath)) !== manifest.userPart.sha256) {
        throw unreadable()
      }
      await pipeline(
        createReadStream(sealedPath),
        createDecryptStream(key, urls.keyVersion),
        createGunzip(),
        createWriteStream(plainPath),
      ).catch(() => {
        throw unreadable()
      })
      blobPaths = await downloadBlobs(
        manifest.blobs.map((blob) => blob.hash),
        new Map(urls.blobs.map((blob) => [blob.hash, blob.url])),
        (hash) => cloudTempPath(`cloud-restore-${hash.slice(0, 16)}`, 'gz'),
      )

      const db = new Database(plainPath)
      try {
        withoutTriggers(db, RESOURCE_TABLES, () => {
          for (const path of blobPaths) {
            applyResourceBlob(db, parseSections(gunzipSync(readFileSync(path))))
          }
        })
      } catch {
        throw unreadable()
      } finally {
        db.close()
      }

      const signedIn = readCloudBackupCredential()
      const result = await importDatabase(plainPath)
      saveCloudBackupCredential(signedIn)
      if (!result.success) {
        logger.error(`Cloud restore failed: ${result.message}`)
        throw new CloudBackupError('restore_failed', 500)
      }
      rebuildSongSearchIndex()
      rebuildBibleSearchIndex()
      logger.info(`Cloud backup restored (${blobPaths.length} resource blobs)`)
      return { requiresRestart: result.requiresRestart }
    } finally {
      await unlink(sealedPath).catch(() => {})
      await unlink(plainPath).catch(() => {})
      for (const path of blobPaths) await unlink(path).catch(() => {})
    }
  })
}
