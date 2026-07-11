import { getBackupConfig, upsertBackupConfig } from './backupConfig'
import { uploadBackup } from './uploadBackup'
import { createLogger } from '../../utils/logger'

const logger = createLogger('backup')

/** How often the scheduler wakes to check whether a backup is due. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let isRunning = false

/**
 * Runs an automatic backup if auto-backup is enabled and the configured
 * interval has elapsed since the last successful backup. No-op otherwise.
 * Guards against overlapping runs.
 */
export async function runScheduledBackupIfDue(): Promise<void> {
  if (isRunning) return

  const config = await getBackupConfig()
  if (!config.autoBackupEnabled) return

  const intervalMs = config.intervalHours * 60 * 60 * 1000
  const lastBackupMs = config.lastBackupAt ?? 0
  if (Date.now() - lastBackupMs < intervalMs) return

  isRunning = true
  try {
    logger.info('Running scheduled backup...')
    const result = await uploadBackup()
    if (result.success) {
      await upsertBackupConfig({ lastBackupAt: Date.now() })
      logger.info(`Scheduled backup completed: ${result.fileName}`)
    } else {
      logger.warning(`Scheduled backup failed: ${result.error}`)
    }
  } finally {
    isRunning = false
  }
}

/**
 * Starts the periodic auto-backup scheduler. Idempotent — calling twice keeps a
 * single timer. `unref()` lets the process exit without waiting on the timer.
 */
export function startBackupScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    void runScheduledBackupIfDue()
  }, CHECK_INTERVAL_MS)
  timer.unref?.()
  logger.info('Backup scheduler started')
}

/** Stops the scheduler (used in tests / shutdown). */
export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
