import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

import { buildBackupFileName, isBackupFile } from './constants'
import { getBackupConfig, upsertBackupConfig } from './backupConfig'
import { createLogger } from '../../utils/logger'
import { checkpointAndExport } from '../database/database'

const logger = createLogger('backup')

export interface LocalBackupFile {
  /** File name, which doubles as the id (the folder is fixed by config). */
  name: string
  /** Absolute path, shown so the operator can find it outside the app. */
  path: string
  sizeBytes: number
  createdAtMs: number
  appVersion: string | null
}

export interface LocalBackupResult {
  success: boolean
  fileName?: string
  path?: string
  error?: string
}

/**
 * Pulls the app version out of `church-hub-backup-v0.1.85-<iso>.db`. Returns
 * null for names that don't carry one (hand-renamed files, older layouts).
 */
function parseAppVersion(fileName: string): string | null {
  const match = fileName.match(/-v([0-9][^-]*(?:\.[^-]+)*)-\d{4}-/)
  return match?.[1] ?? null
}

/**
 * Resolves the configured local backup folder, or null when local backups are
 * off. Relative paths are rejected: the folder is written to unattended by the
 * scheduler, and resolving it against the process CWD would put backups
 * somewhere the operator never chose.
 */
export async function getLocalBackupDir(): Promise<string | null> {
  const config = await getBackupConfig()
  const path = config.localBackupPath?.trim()
  if (!path) return null
  if (!isAbsolute(path)) {
    logger.warning(`Local backup path is not absolute, ignoring: ${path}`)
    return null
  }
  return path
}

/**
 * Lists the backups present in the configured folder, newest first. Returns an
 * empty list when local backups are off or the folder is gone (an unplugged
 * external drive is a normal state, not an error).
 */
export async function listLocalBackups(): Promise<LocalBackupFile[]> {
  const dir = await getLocalBackupDir()
  if (!dir) return []

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const files = await Promise.all(
    entries.filter(isBackupFile).map(async (name) => {
      const path = join(dir, name)
      try {
        const info = await stat(path)
        if (!info.isFile()) return null
        return {
          name,
          path,
          sizeBytes: info.size,
          createdAtMs: info.mtimeMs,
          appVersion: parseAppVersion(name),
        }
      } catch {
        return null
      }
    }),
  )

  return files
    .filter((file): file is LocalBackupFile => file !== null)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
}

/**
 * Deletes older local backups so at most `maxBackups` remain — the same
 * retention setting Drive backups use, so both copies stay in step.
 */
export async function pruneLocalBackups(): Promise<void> {
  const config = await getBackupConfig()
  const files = await listLocalBackups()
  const excess = files.slice(Math.max(1, config.maxBackups))

  for (const file of excess) {
    try {
      await unlink(file.path)
      logger.info(`Pruned local backup: ${file.name}`)
    } catch (error) {
      logger.warning(`Failed to prune local backup ${file.name}: ${error}`)
    }
  }
}

/**
 * Writes a backup to the configured local folder.
 *
 * Uses the same `checkpointAndExport` the Drive upload does — a WAL checkpoint
 * followed by a plain file copy — so a local backup is byte-for-byte the same
 * artefact and restores through the same path. Independent of Drive: this works
 * with no Google account connected at all.
 */
export async function runLocalBackup(): Promise<LocalBackupResult> {
  const dir = await getLocalBackupDir()
  if (!dir) {
    return { success: false, error: 'no_local_path' }
  }

  const fileName = buildBackupFileName(process.env.APP_VERSION || 'dev')
  const destination = join(dir, fileName)

  try {
    // Creates the folder tree if the operator picked one that doesn't exist
    // yet; a no-op when it does.
    await mkdir(dir, { recursive: true })
    await checkpointAndExport(destination)

    await upsertBackupConfig({ lastLocalBackupAt: Date.now() })
    await pruneLocalBackups()

    logger.info(`Local backup written: ${destination}`)
    return { success: true, fileName, path: destination }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Local backup failed: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * Deletes one local backup by file name. The name is resolved inside the
 * configured folder and validated against the backup naming convention, so a
 * crafted request cannot reach arbitrary files.
 */
export async function deleteLocalBackup(
  fileName: string,
): Promise<LocalBackupResult> {
  const dir = await getLocalBackupDir()
  if (!dir) {
    return { success: false, error: 'no_local_path' }
  }
  if (!isBackupFile(fileName) || fileName.includes('/') || fileName.includes('\\')) {
    return { success: false, error: 'invalid_file_name' }
  }

  try {
    await unlink(join(dir, fileName))
    logger.info(`Deleted local backup: ${fileName}`)
    return { success: true, fileName }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to delete local backup ${fileName}: ${message}`)
    return { success: false, error: message }
  }
}
