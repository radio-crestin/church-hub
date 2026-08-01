import { basename, isAbsolute, join } from 'node:path'

import { isBackupFile } from './constants'
import { getLocalBackupDir } from './localBackup'
import { createLogger } from '../../utils/logger'
import { importDatabase } from '../database'

const logger = createLogger('backup')

export interface RestoreLocalBackupInput {
  /** A file inside the configured local backup folder. */
  fileName?: string
  /** Absolute path to a backup anywhere on disk — a folder the operator picked. */
  path?: string
}

export interface RestoreLocalBackupResult {
  success: boolean
  message: string
  requiresRestart: boolean
  error?: string
}

/**
 * Turns a request into the absolute file to restore from, or an error code.
 *
 * Two shapes are accepted because they answer different questions. `fileName`
 * is "restore the copy I made here", resolved inside the configured folder and
 * never allowed to escape it. `path` is "restore the copy I just found",
 * pointing anywhere the operator can browse to — a USB stick, a network share,
 * last month's folder — which is the whole point of choosing a folder at restore
 * time. Both require the backup naming convention, so neither can be pointed at
 * an unrelated file by accident.
 */
function resolveSourcePath(
  input: RestoreLocalBackupInput,
  configuredDir: string | null,
): { path: string } | { error: string } {
  const explicit = input.path?.trim()
  if (explicit) {
    if (!isAbsolute(explicit)) return { error: 'path_not_absolute' }
    if (!isBackupFile(basename(explicit))) return { error: 'invalid_file_name' }
    return { path: explicit }
  }

  const fileName = input.fileName?.trim()
  if (!fileName) return { error: 'no_source' }
  if (
    !isBackupFile(fileName) ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    return { error: 'invalid_file_name' }
  }
  if (!configuredDir) return { error: 'no_local_path' }
  return { path: join(configuredDir, fileName) }
}

/**
 * Replaces the live database with a backup sitting on disk.
 *
 * Delegates to `importDatabase`, the same whole-file swap the Drive restore
 * uses: it checkpoints and closes the current database, keeps a `.backup` copy
 * of it, copies the source over, and reinitialises in-process — rolling back to
 * that copy if the reinitialisation fails. Nothing is deleted row by row, so a
 * restore is all-or-nothing and a failed one leaves the operator where they
 * started.
 *
 * No temp file is involved, unlike the Drive path, because the source is already
 * a local file and copying it twice would only double the I/O on databases that
 * can run to hundreds of megabytes.
 */
export async function restoreLocalBackup(
  input: RestoreLocalBackupInput,
): Promise<RestoreLocalBackupResult> {
  const configuredDir = await getLocalBackupDir()
  const resolved = resolveSourcePath(input, configuredDir)

  if ('error' in resolved) {
    logger.warning(`Local restore refused: ${resolved.error}`)
    return {
      success: false,
      message: '',
      requiresRestart: false,
      error: resolved.error,
    }
  }

  logger.info(`Restoring database from local backup: ${resolved.path}`)
  const result = await importDatabase(resolved.path)

  if (!result.success) {
    logger.error(`Local restore failed: ${result.message}`)
  } else {
    logger.info('Local restore completed')
  }

  return {
    success: result.success,
    message: result.message,
    requiresRestart: result.requiresRestart,
    error: result.success ? undefined : result.message,
  }
}
