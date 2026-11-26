import { CloudBackupError } from './CloudBackupError'
import { readCloudBackupCredential } from './cloudBackupCredential'
import { getCloudBackupSchedule } from './cloudBackupSchedule'
import { uploadCloudBackup } from './uploadCloudBackup'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('backup')

/**
 * Backs up to Church Hub Cloud when automatic cloud backups are on, this
 * PC is signed in and the interval has passed since the last one. A
 * failure is logged and tried again at the next check.
 */
export async function runScheduledCloudBackupIfDue(): Promise<void> {
  const schedule = getCloudBackupSchedule()
  if (!schedule.autoBackupEnabled || !readCloudBackupCredential()) return
  const intervalMs = schedule.intervalHours * 60 * 60 * 1000
  if (Date.now() - (schedule.lastBackupAt ?? 0) < intervalMs) return
  try {
    logger.info('Running scheduled cloud backup...')
    await uploadCloudBackup()
  } catch (error) {
    const code = error instanceof CloudBackupError ? error.code : String(error)
    logger.warning(`Scheduled cloud backup failed: ${code}`)
  }
}
