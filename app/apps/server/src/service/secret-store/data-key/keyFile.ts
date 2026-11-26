import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { createLogger } from '../../../utils/logger'
import type { KeyStore } from '../keyRing'

const logger = createLogger('secret-store')
const FILE_NAME = 'secret-key.json'

/**
 * Which data key this data folder uses and where it lives: its id, and
 * either "os" (the key is in the OS secret store under that id) or "file"
 * (no secret store: the key itself is here). Never inside the database, so
 * no backup of the database carries it.
 */
export interface KeyFile {
  id: string
  store: KeyStore
  /** base64, only when store is "file". */
  key?: string
}

export const keyFilePath = (dataDir: string) => join(dataDir, FILE_NAME)

const isKeyFile = (value: unknown): value is KeyFile => {
  const file = value as KeyFile
  return (
    typeof file?.id === 'string' &&
    (file.store === 'os' ||
      (file.store === 'file' && typeof file.key === 'string'))
  )
}

/**
 * The key file, or null when there is none. An unreadable one is logged and
 * treated as missing: a key in the OS store is still found by the id each
 * sealed value carries (findDataKey).
 */
export function readKeyFile(path: string): KeyFile | null {
  if (!existsSync(path)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (isKeyFile(parsed)) return parsed
  } catch (error) {
    logger.error(`Could not read ${path}: ${error}`)
    return null
  }
  logger.error(`${path} is not a data key file`)
  return null
}

/** Writes the key file readable by this user only (0600 on macOS/Linux). */
export function writeKeyFile(path: string, file: KeyFile): void {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, JSON.stringify(file), { mode: 0o600 })
  chmodSync(temporary, 0o600)
  renameSync(temporary, path)
}
