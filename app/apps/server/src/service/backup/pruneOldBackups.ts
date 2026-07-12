import type { drive_v3 } from 'googleapis'

import { APP_DATA_FOLDER, isBackupFile, MAX_BACKUPS } from './constants'
import { createLogger } from '../../utils/logger'

const logger = createLogger('backup')

/**
 * Keeps only the most recent `MAX_BACKUPS` backups in the app-data folder,
 * deleting older ones. Failures to delete individual files are logged but do not
 * abort the caller (a fresh backup has already been uploaded by then).
 */
export async function pruneOldBackups(drive: drive_v3.Drive): Promise<void> {
  const res = await drive.files.list({
    spaces: APP_DATA_FOLDER,
    orderBy: 'createdTime desc',
    pageSize: 100,
    fields: 'files(id, name, createdTime)',
  })

  const backups = (res.data.files ?? []).filter((f) => isBackupFile(f.name))
  const toDelete = backups.slice(MAX_BACKUPS)

  for (const file of toDelete) {
    if (!file.id) continue
    try {
      await drive.files.delete({ fileId: file.id })
      logger.debug(`Pruned old backup: ${file.name} (${file.id})`)
    } catch (error) {
      logger.warning(`Failed to prune backup ${file.id}: ${error}`)
    }
  }
}
