import { randomBytes } from 'node:crypto'

import { type KeyFile, keyFilePath, readKeyFile, writeKeyFile } from './keyFile'
import { osStoreName, readOsKey, writeOsKey } from './osKeyStore'
import { preferredStore } from './preferredStore'
import { createLogger } from '../../../utils/logger'
import {
  hasActiveKey,
  type KeyStore,
  markLocked,
  setActiveKey,
} from '../keyRing'

const logger = createLogger('secret-store')

function useKey(id: string, key: Buffer, store: KeyStore): void {
  setActiveKey({ id, key }, store)
  logger.info(
    store === 'os'
      ? `Secrets are sealed with a key kept in the ${osStoreName()}`
      : 'Secrets are sealed with a key kept in secret-key.json in the data folder (no OS secret store)',
  )
}

/** A new random 256-bit key, in the OS store when it can take it. */
async function createDataKey(path: string): Promise<void> {
  const id = randomBytes(8).toString('base64url')
  const key = randomBytes(32)
  const preference = preferredStore()
  if (preference !== 'file') {
    try {
      await writeOsKey(id, key)
      writeKeyFile(path, { id, store: 'os' })
      useKey(id, key, 'os')
      return
    } catch (error) {
      if (preference === 'os') throw error
      logger.warning(`No OS secret store to keep the data key in: ${error}`)
    }
  }
  writeKeyFile(path, { id, store: 'file', key: key.toString('base64') })
  useKey(id, key, 'file')
}

/** The key file's key, or false when it is gone from the OS store. */
async function openKeyFile(file: KeyFile): Promise<boolean> {
  if (file.store === 'file') {
    useKey(file.id, Buffer.from(file.key ?? '', 'base64'), 'file')
    return true
  }
  const key = await readOsKey(file.id)
  if (!key) return false
  useKey(file.id, key, 'os')
  return true
}

/**
 * Opens this data folder's key before the database is opened, or makes one
 * on the first start. When the OS store holds the key but can't be reached
 * (a locked Linux keyring, a timeout), the server starts without it: sealed
 * secrets read as missing and saving one fails, nothing is overwritten, and
 * the next start (or restore) tries again. A key the store no longer has
 * is replaced; the values sealed with it are then forgotten
 * (sealStoredSecrets).
 */
export async function loadDataKey(dataDir: string): Promise<void> {
  if (hasActiveKey()) return
  const path = keyFilePath(dataDir)
  const file = readKeyFile(path)
  if (file) {
    try {
      if (await openKeyFile(file)) return
      logger.warning(
        `The ${osStoreName()} no longer has data key ${file.id}: making a new one`,
      )
    } catch (error) {
      markLocked(String(error))
      logger.error(
        `Could not open the data key in the ${osStoreName()}: ${error}. Saved passwords and keys can't be used until it opens; restart Church Hub once it is unlocked.`,
      )
      return
    }
  }
  await createDataKey(path)
}
