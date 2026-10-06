import { deleteOldNotifications } from './deleteNotifications'
import { createLogger } from '../../utils/logger'

const logger = createLogger('notifications')

const DAILY_MS = 24 * 60 * 60 * 1000

function cleanUp(): void {
  const deleted = deleteOldNotifications()
  if (deleted > 0)
    logger.info(`Deleted ${deleted} notifications older than 60 days`)
}

/** Drops notifications older than 60 days, at start and then daily. */
export function startNotificationCleanup(): void {
  cleanUp()
  setInterval(cleanUp, DAILY_MS)
}
